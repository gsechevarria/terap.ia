-- =============================================================================
-- Cierre de RLS antes de habilitar la auth de pacientes (jul 2026)
--
-- Adaptación del plan "Terap — cierre de RLS v2" al esquema y al código reales.
-- Objetivo: que un paciente autenticado NO pueda reescribir su ficha, reescribir
-- cualquier columna de sus citas, fabricar la prueba de consentimiento, leer
-- documentos no compartidos ni alterar el histórico del diario.
--
-- PASO 0 (auditoría) — YA VERIFICADO: las 4 funciones helper de RLS
--   (current_professional_id, current_patient_id, current_patient_professional_id,
--    professional_owns_patient) son SECURITY DEFINER con `set search_path = ''`
--   (ver 20260717180002_identity.sql). No requieren cambios.
--
-- APLICAR EN STAGING PRIMERO. Probar con un JWT de usuario real (NO desde el SQL
--   editor: corre como postgres y salta la RLS). Ver notas al pie.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- FASE 1 · patients — la ficha pasa a solo lectura para el paciente
-- ---------------------------------------------------------------------------
-- El paciente podía UPDATE su propia fila (patients_guard ya frenaba cambiar
-- professional_id/status, pero el resto era libre). La ficha es documento
-- clínico del profesional; corregir un dato es una conversación, no
-- autoservicio (RGPD art. 16 = proceso, no formulario).
drop policy if exists patients_update_self on public.patients;
-- patients_select_self se MANTIENE: el paciente debe poder ver su ficha.

-- ---------------------------------------------------------------------------
-- FASE 2 · appointments — el paciente solo confirma/cancela, vía RPC acotada
-- ---------------------------------------------------------------------------
-- La política permitía UPDATE de cualquier columna (starts_at, notes del
-- psicólogo, professional_id...). Se sustituye por una función acotada.
--
-- ADAPTACIÓN al esquema real: el paciente actúa sobre `status`
-- (scheduled → confirmed | cancelled), NO sobre `attendance` (registro clínico
-- del profesional: attended/no_show/late_cancel). Por eso la función opera
-- sobre status, no sobre attendance como sugería el borrador.
drop policy if exists appointments_update_by_patient on public.appointments;

create or replace function public.patient_respond_appointment(
  p_appointment_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
begin
  select id into v_patient_id
  from public.patients
  where user_id = auth.uid();

  if v_patient_id is null then
    raise exception 'no linked patient record';
  end if;

  if p_action not in ('confirm', 'cancel') then
    raise exception 'invalid action';
  end if;

  update public.appointments
     set status = case
                    when p_action = 'confirm' then 'confirmed'::public.appointment_status
                    else 'cancelled'::public.appointment_status
                  end,
         updated_at = now()
   where id = p_appointment_id
     and patient_id = v_patient_id
     and status in ('scheduled', 'confirmed');  -- no tocar completadas/canceladas

  if not found then
    raise exception 'appointment not available for this patient';
  end if;
end;
$$;

revoke all on function public.patient_respond_appointment(uuid, text) from public, anon;
grant execute on function public.patient_respond_appointment(uuid, text) to authenticated;

-- appointments_select_by_patient y appointments_all_by_professional se mantienen.

-- ---------------------------------------------------------------------------
-- FASE 3 · consents — la firma es prueba de base jurídica (art. 9)
-- ---------------------------------------------------------------------------
-- Antes: consents_insert_by_patient solo validaba patient_id; professional_id,
-- template_version, accepted y content_hash eran libres → el interesado podía
-- fabricar su propia evidencia (no vale).
-- Ahora: el paciente firma por RPC y el hash se calcula del `body` de la
-- plantilla ALMACENADA EN BD (fuente de verdad), no de un texto que él controle.
--
-- ADAPTACIÓN: la app firmaba un texto por defecto con template_id NULL. Se
-- introduce una plantilla por defecto por profesional (backfill + alta) con el
-- MISMO texto que mostraba la app (lib/consent.ts, v1) para no romper el alta.
drop policy if exists consents_insert_by_patient on public.consents;

-- Crea la plantilla por defecto del profesional si no tiene ninguna activa.
create or replace function public.ensure_consent_template(p_professional_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.consent_templates
    where professional_id = p_professional_id and active
  ) then
    insert into public.consent_templates (professional_id, title, body, version, active)
    values (
      p_professional_id,
      'Consentimiento informado',
      $consent$Al continuar, confirmas que has leído y aceptas lo siguiente:

1. terap.ia es un espacio de acompañamiento entre tu profesional de psicología y tú. No sustituye la atención sanitaria presencial ni es un canal de urgencias.

2. En caso de emergencia o riesgo, utiliza el botón de emergencia (024 / 112), siempre visible en la app.

3. Tu profesional podrá proponerte tareas, citas y, si lo activa expresamente, cuestionarios. La app no interpreta ni ofrece recomendaciones clínicas por sí misma.

4. Puedes registrar tu estado de ánimo y completar tareas de forma voluntaria. Tú decides qué compartir.

5. Entorno de demostración: durante esta fase se utilizan únicamente datos ficticios.

Marcando la casilla y continuando, otorgas tu consentimiento informado para el uso de terap.ia con tu profesional.$consent$,
      1,
      true
    );
  end if;
end;
$$;

-- El seed (service_role) la invoca para los profesionales demo.
revoke all on function public.ensure_consent_template(uuid) from public, anon;
grant execute on function public.ensure_consent_template(uuid) to service_role;

-- Backfill: plantilla por defecto para los profesionales ya existentes.
do $$
declare r record;
begin
  for r in select id from public.professionals loop
    perform public.ensure_consent_template(r.id);
  end loop;
end $$;

-- Alta de profesional: ahora crea también su plantilla de consentimiento.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pro_id uuid;
begin
  if new.raw_user_meta_data ->> 'role' = 'professional' then
    insert into public.professionals (user_id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
    on conflict (user_id) do nothing
    returning id into v_pro_id;
    if v_pro_id is not null then
      perform public.ensure_consent_template(v_pro_id);
    end if;
  end if;
  return new;
end;
$$;

-- Firma del consentimiento por el paciente (idempotente). Resuelve paciente,
-- profesional y plantilla activa desde el servidor; hashea el body de BD.
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
    accepted, content_hash, signed_at
  ) values (
    v_professional_id, v_patient_id, v_tid, v_ver,
    true, encode(extensions.digest(v_body, 'sha256'), 'hex'), now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.patient_accept_consent() from public, anon;
grant execute on function public.patient_accept_consent() to authenticated;

-- consents_select_by_patient / consents_select_by_professional se mantienen.

-- ---------------------------------------------------------------------------
-- FASE 4 · documents — visibilidad explícita, cerrada por defecto
-- ---------------------------------------------------------------------------
-- Hoy cualquier documento de la ficha sería legible por el paciente. El
-- profesional asume que lo que sube al expediente es suyo. Defecto en false:
-- no expone nada retroactivamente.
alter table public.documents
  add column if not exists shared_with_patient boolean not null default false;

drop policy if exists documents_select_by_patient on public.documents;

create policy documents_select_by_patient on public.documents
  for select to authenticated
  using (
    patient_id = (select public.current_patient_id())
    and shared_with_patient
  );
-- OJO: esto protege la FILA, no el binario en Storage (bucket `files`). Las
-- políticas de storage.objects se revisan aparte. Hoy no hay vista de documentos
-- en la app del paciente, así que no se expone nada por ahora.

-- ---------------------------------------------------------------------------
-- FASE 5 · mood_entries — inmutable pasado el día
-- ---------------------------------------------------------------------------
-- Era ALL: el paciente podía reescribir/borrar semanas atrás y destruir la
-- serie. Corregir el mismo día es legítimo (alinea con scale_responses,
-- insert-only). El campo `note` NO se elimina: lo usa el diario (MoodLogger).
drop policy if exists mood_entries_all_by_patient on public.mood_entries;

create policy mood_entries_insert_by_patient on public.mood_entries
  for insert to authenticated
  with check (patient_id = (select public.current_patient_id()));

create policy mood_entries_select_by_patient on public.mood_entries
  for select to authenticated
  using (patient_id = (select public.current_patient_id()));

create policy mood_entries_update_today on public.mood_entries
  for update to authenticated
  using (
    patient_id = (select public.current_patient_id())
    and entry_date = current_date
  )
  with check (
    patient_id = (select public.current_patient_id())
    and entry_date = current_date
  );

create policy mood_entries_delete_today on public.mood_entries
  for delete to authenticated
  using (
    patient_id = (select public.current_patient_id())
    and entry_date = current_date
  );
-- mood_entries_select_by_professional se mantiene.

-- ---------------------------------------------------------------------------
-- FASE 6 · un user_id = un paciente (restricción explícita)
-- ---------------------------------------------------------------------------
-- current_patient_id() es escalar; con dos filas para el mismo user_id el
-- comportamiento sería indefinido. Mejor fallar en el insert.
-- Antes de aplicar, comprobar que no haya duplicados:
--   select user_id, count(*) from patients where user_id is not null
--   group by user_id having count(*) > 1;
create unique index if not exists patients_user_id_unique
  on public.patients (user_id) where user_id is not null;
