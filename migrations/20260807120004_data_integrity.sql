-- =============================================================================
-- Integridad del modelo de datos (ago 2026)
-- Cada bloque conserva su porqué: son restricciones con motivo legal o clínico,
-- no preferencias de esquema.
-- =============================================================================

-- Borrar un usuario de auth NO puede destruir la consulta entera.
-- Hoy: auth.users → professionals → patients → todo, en cascada, irreversible.
-- Incompatible con Ley 41/2002 art. 17 (historia clínica: 5 años mínimo).
alter table public.professionals
  drop constraint if exists professionals_user_id_fkey;
alter table public.professionals
  add constraint professionals_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete restrict;
alter table public.professionals add column if not exists deleted_at timestamptz;

-- El profesional tiene FOR ALL sobre scale_assignments: borrar una asignación
-- hoy borra TODO el histórico PHQ-9/GAD-7 asociado. La UI solo desactiva, pero
-- la RLS permite el DELETE directo por PostgREST.
alter table public.scale_responses
  drop constraint if exists scale_responses_assignment_id_fkey;
alter table public.scale_responses
  add constraint scale_responses_assignment_id_fkey
      foreign key (assignment_id) references public.scale_assignments (id)
      on delete restrict;

-- ---------------------------------------------------------------------------
-- patients.user_id solo lo escribe accept_invitation
-- ---------------------------------------------------------------------------
-- `patients_guard` protegía `professional_id` y `status`, pero no `user_id`: el
-- profesional podía ceder o bloquear el acceso a la ficha sin token, sin
-- caducidad y sin registro. Se amplía el guard usando un GUC local que solo
-- fija `accept_invitation` dentro de su propia transacción.
create or replace function public.patients_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.current_professional_id() is distinct from old.professional_id
     and (new.professional_id is distinct from old.professional_id
          or new.status is distinct from old.status) then
    raise exception 'No autorizado a modificar el vínculo o el estado del paciente';
  end if;

  -- El vínculo con la cuenta solo se establece aceptando una invitación.
  --
  -- Se permite en dos casos:
  --  · `accept_invitation` marca el GUC `terapia.linking_patient` dentro de su
  --    transacción (`current_setting(..., true)` devuelve NULL si no está);
  --  · `auth.uid()` es NULL, es decir, la llamada NO viene de un usuario
  --    autenticado por PostgREST sino de `service_role`/`postgres` (seed,
  --    scripts de prueba, mantenimiento). Ese rol ya salta la RLS entera, así
  --    que bloquearlo aquí no aportaría seguridad y sí rompería el seed.
  --
  -- Lo que se cierra es el caso real del hallazgo: un PROFESIONAL autenticado
  -- reasignando o borrando el `user_id` de una ficha por PostgREST, sin token,
  -- sin caducidad y sin dejar registro.
  if new.user_id is distinct from old.user_id
     and auth.uid() is not null
     and coalesce(current_setting('terapia.linking_patient', true), '') <> 'on' then
    raise exception 'El vínculo con la cuenta solo se establece aceptando una invitación';
  end if;

  return new;
end;
$$;

-- `accept_invitation` marca el GUC (local: solo dura la transacción) antes de
-- escribir `user_id`. Se redefine entera para no perder lo de 20260807120002.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.invitations%rowtype;
  v_uid   uuid := auth.uid();
  v_email text;
  v_hash  text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  if v_uid is null then
    raise exception 'autenticación requerida';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_inv from public.invitations
   where token_hash = v_hash
     and accepted_at is null
     and expires_at > now()
   for update;
  if not found then
    raise exception 'Invitación inválida, caducada o ya utilizada'
      using errcode = 'P0001';
  end if;

  if v_inv.email is null
     or lower(v_inv.email) is distinct from lower(v_email) then
    raise exception 'Esta invitación no corresponde a tu cuenta'
      using errcode = 'P0002';
  end if;

  if exists (select 1 from public.patients where user_id = v_uid) then
    raise exception 'La cuenta ya está vinculada a un paciente'
      using errcode = 'P0003';
  end if;

  if exists (
    select 1 from public.patients
     where id = v_inv.patient_id and user_id is not null
  ) then
    raise exception 'Esta ficha ya tiene una cuenta vinculada'
      using errcode = 'P0004';
  end if;

  perform set_config('terapia.linking_patient', 'on', true);

  update public.patients
     set user_id = v_uid,
         email = coalesce(email, v_email)
   where id = v_inv.patient_id;

  perform set_config('terapia.linking_patient', 'off', true);

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.patient_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Unicidades que faltaban
-- ---------------------------------------------------------------------------

-- Una sola tarifa por defecto: UNIQUE trata los NULL como distintos, así que
-- podían coexistir N tarifas por defecto para el mismo profesional + tipo de
-- sesión, y `settleAttendedAppointment` cobraba la que devolviese el motor.
create unique index if not exists payment_settings_default_uq
  on public.payment_settings (professional_id, session_type)
  where patient_id is null;

-- Un token push no puede pertenecer a dos usuarios: con `unique (user_id,
-- token)`, tras cerrar sesión y entrar otra persona en el mismo móvil, la
-- segunda recibía las notificaciones de salud de la primera.
delete from public.device_push_tokens a
 using public.device_push_tokens b
 where a.token = b.token
   and a.created_at < b.created_at;
alter table public.device_push_tokens
  drop constraint if exists device_push_tokens_user_id_token_key;
create unique index if not exists device_push_tokens_token_uq
  on public.device_push_tokens (token);

-- ---------------------------------------------------------------------------
-- Diario: una entrada por día y solo del día en curso
-- ---------------------------------------------------------------------------
-- El INSERT no restringía `entry_date`, así que la inmutabilidad que introdujo
-- 20260725090001 (solo se edita el mismo día) se esquivaba retrodatando.
-- Se deduplica antes de crear el índice, conservando la más reciente.
delete from public.mood_entries a
 using public.mood_entries b
 where a.patient_id = b.patient_id
   and a.entry_date = b.entry_date
   and a.created_at < b.created_at;
create unique index if not exists mood_entries_patient_day_uq
  on public.mood_entries (patient_id, entry_date);

drop policy if exists mood_entries_insert_by_patient on public.mood_entries;
create policy mood_entries_insert_by_patient on public.mood_entries
  for insert to authenticated
  with check (
    patient_id = (select public.current_patient_id())
    and entry_date = current_date
  );

-- ---------------------------------------------------------------------------
-- Consentimiento: la evidencia del art. 9.2.h no se reescribe
-- ---------------------------------------------------------------------------
-- El profesional podía reescribir el `body` de una plantilla ya firmada sin
-- subir la versión, dejando inservible la prueba de la base jurídica ante la
-- AEPD (la firma apunta a un texto que ya no es el que se aceptó).
create or replace function public.consent_template_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.body is distinct from old.body
      or new.version is distinct from old.version)
     and exists (select 1 from public.consents where template_id = old.id) then
    raise exception 'Plantilla ya firmada: cree una versión nueva';
  end if;
  return new;
end;
$$;

drop trigger if exists consent_templates_immutable on public.consent_templates;
create trigger consent_templates_immutable
  before update on public.consent_templates
  for each row execute function public.consent_template_immutable();

-- Guardar el texto firmado, no solo su hash: con el hash a solas hay que
-- conservar el original en otro sitio para poder demostrar qué se aceptó.
alter table public.consents add column if not exists content_body text;

-- `patient_accept_consent` rellena `content_body` junto al hash. Se redefine
-- entera (viene de 20260725090001); el resto del comportamiento no cambia.
create or replace function public.patient_accept_consent()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_professional_id uuid;
  v_tid uuid;
  v_ver int;
  v_body text;
  v_existing uuid;
  v_id uuid;
begin
  select id, professional_id into v_patient_id, v_professional_id
  from public.patients
  where user_id = auth.uid();

  if v_patient_id is null then
    raise exception 'no linked patient record';
  end if;

  select id into v_existing
  from public.consents
  where patient_id = v_patient_id
  limit 1;
  if v_existing is not null then
    return v_existing;  -- ya firmado; idempotente
  end if;

  select id, version, body into v_tid, v_ver, v_body
  from public.consent_templates
  where professional_id = v_professional_id and active
  order by version desc
  limit 1;
  if v_tid is null then
    raise exception 'no active consent template for professional';
  end if;

  insert into public.consents (
    professional_id, patient_id, template_id, template_version,
    accepted, content_hash, content_body, signed_at
  ) values (
    v_professional_id, v_patient_id, v_tid, v_ver,
    true, encode(extensions.digest(v_body, 'sha256'), 'hex'), v_body, now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.patient_accept_consent() from public, anon;
grant execute on function public.patient_accept_consent() to authenticated;

create unique index if not exists consent_templates_pro_version_uq
  on public.consent_templates (professional_id, version);

-- Un consentimiento vigente por paciente (la RPC ya es idempotente).
create unique index if not exists consents_patient_uq
  on public.consents (patient_id);
