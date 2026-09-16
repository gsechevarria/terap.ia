-- =============================================================================
-- Registro profesional, invitaciones (a un centro y a un expediente) y correo
--
-- Todo lo que decide quién entra y con qué permisos vive aquí, en funciones
-- SECURITY DEFINER, y NO en políticas de escritura: hay que comprobar varias
-- cosas a la vez (organización, membresía, acreditación, caducidad, límites) y
-- dejar rastro. Ninguna de estas tablas tiene política de INSERT o UPDATE.
--
-- Sobre los tokens (§9 del encargo):
--   · 256 bits de aleatoriedad criptográfica, generados en Node.
--   · En base de datos SOLO el SHA-256. El claro vive en el enlace y nada más.
--   · 48 horas por defecto, configurable por llamada.
--   · Un solo uso, y ABRIR EL ENLACE NO LO CONSUME: los antivirus de correo
--     visitan las URL automáticamente. Se consume al aceptar explícitamente.
--   · Reemitir invalida las anteriores que siguieran vivas.
--   · La validez se vuelve a comprobar AL ACEPTAR, no solo al emitir.
-- =============================================================================

begin;

do $$ begin
  create type public.invite_target as enum ('patient_access', 'org_membership');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_delivery_status as enum
    ('pending', 'sent', 'failed', 'no_provider');
exception when duplicate_object then null; end $$;

-- --- Invitación de paciente: se completa lo que le faltaba -------------------
alter table public.invitations
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade,
  add column if not exists invited_by      uuid references public.professionals (id) on delete set null,
  add column if not exists revoked_at      timestamptz,
  add column if not exists kind            public.invite_target not null default 'patient_access';

update public.invitations i
   set organization_id = p.organization_id
  from public.patients p
 where p.id = i.patient_id and i.organization_id is null;

-- Si quedara alguna sin organización derivable, la migración para: es una
-- invitación cuyo expediente ya no existe y no se inventa a dónde apunta.
do $$
declare v int;
begin
  select count(*) into v from public.invitations where organization_id is null;
  if v > 0 then
    raise exception 'Hay % invitación(es) sin organización derivable', v;
  end if;
end $$;

alter table public.invitations alter column organization_id set not null;
alter table public.invitations alter column expires_at set default (now() + interval '48 hours');
create index if not exists invitations_org_idx on public.invitations (organization_id);
create index if not exists invitations_live_idx
  on public.invitations (patient_id) where accepted_at is null and revoked_at is null;

-- --- Invitación de profesional a un centro -----------------------------------
create table if not exists public.professional_invitations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  email               text not null,
  token_hash          text not null unique,
  role                public.org_member_role not null default 'member',
  can_invite_patients boolean not null default true,
  invited_by          uuid not null references public.professionals (id) on delete cascade,
  expires_at          timestamptz not null default (now() + interval '48 hours'),
  accepted_at         timestamptz,
  accepted_by         uuid references public.professionals (id) on delete set null,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists professional_invitations_org_idx
  on public.professional_invitations (organization_id);
create index if not exists professional_invitations_live_idx
  on public.professional_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.professional_invitations enable row level security;
drop policy if exists professional_invitations_select_team on public.professional_invitations;
create policy professional_invitations_select_team on public.professional_invitations
  for select to authenticated using (public.can_manage_org(organization_id));

-- --- Cola de correo ----------------------------------------------------------
-- Distingue lo que el encargo pide distinguir: invitación CREADA, envío
-- ACEPTADO POR EL PROVEEDOR, y FALLO. `no_provider` es el cuarto estado real
-- de este despliegue: sin credenciales configuradas no se finge ningún envío.
--
-- `payload` NUNCA lleva contenido clínico ni el token: solo el nombre de la
-- organización y la caducidad, que es lo único que el correo puede decir.
create table if not exists public.email_deliveries (
  id            uuid primary key default gen_random_uuid(),
  to_email      text not null,
  template      text not null,
  subject_type  text,
  subject_id    uuid,
  organization_id uuid references public.organizations (id) on delete set null,
  status        public.email_delivery_status not null default 'pending',
  provider_id   text,
  error         text,
  attempts      int not null default 0,
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists email_deliveries_status_idx on public.email_deliveries (status, created_at);
alter table public.email_deliveries enable row level security;
-- Sin políticas: solo `service_role` la toca. Un correo pendiente revela a
-- quién se ha invitado, y eso no tiene por qué verlo la API con clave pública.

-- =============================================================================
-- Registro profesional
-- =============================================================================

/**
 * Alta de profesional desde el asistente público.
 *
 * Crea el perfil en estado `pending` y marca la cuenta como
 * `professional_pending` en `app_metadata`. NO concede el rol `professional`:
 * eso solo llega con la aprobación de un administrador de plataforma. Mientras
 * tanto la cuenta puede consultar su estado y completar el onboarding, y nada
 * más — ni datos clínicos, ni invitar pacientes.
 *
 * Es IDEMPOTENTE: repetirla tras una interrupción actualiza el mismo perfil y
 * la misma organización. No deja organizaciones ni membresías duplicadas, que
 * es exactamente el fallo que pide evitar el encargo.
 */
create or replace function public.register_professional(
  p_full_name        text,
  p_practice_kind    public.organization_kind,
  p_org_name         text default null,
  p_colegio          text default null,
  p_numero_colegiado text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_pro   uuid;
  v_org   uuid;
begin
  if v_uid is null then
    raise exception 'autenticación requerida' using errcode = 'P0100';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'El nombre es obligatorio' using errcode = 'P0101';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Una cuenta ya vinculada a un expediente no puede además registrarse como
  -- profesional con el mismo gesto: son contextos distintos y el encargo pide
  -- que se elijan explícitamente, no que se mezclen en un alta.
  select id into v_pro from public.professionals where user_id = v_uid;

  if v_pro is null then
    insert into public.professionals
      (user_id, email, full_name, verification_status, colegio, numero_colegiado,
       practice_kind, onboarding_completed_at)
    values (v_uid, v_email, trim(p_full_name), 'pending', nullif(trim(p_colegio), ''),
            nullif(trim(p_numero_colegiado), ''), p_practice_kind, now())
    returning id into v_pro;
  else
    -- Reintento: se actualiza, nunca se duplica. Un perfil YA APROBADO no se
    -- devuelve a pendiente por volver a pasar por el asistente.
    update public.professionals
       set full_name = trim(p_full_name),
           colegio = nullif(trim(p_colegio), ''),
           numero_colegiado = nullif(trim(p_numero_colegiado), ''),
           practice_kind = p_practice_kind,
           onboarding_completed_at = coalesce(onboarding_completed_at, now())
     where id = v_pro;
  end if;

  -- `ensure_solo_organization` ya creó una al insertar el profesional. Se
  -- RENOMBRA y RECLASIFICA en vez de crear otra.
  select m.organization_id into v_org
    from public.organization_members m
   where m.professional_id = v_pro and m.role = 'owner' and m.status = 'active'
   order by m.created_at limit 1;

  if v_org is not null then
    update public.organizations
       set name = coalesce(nullif(trim(p_org_name), ''), trim(p_full_name)),
           kind = p_practice_kind
     where id = v_org;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role',
              case when raw_app_meta_data ->> 'role' = 'professional'
                   then 'professional' else 'professional_pending' end)
   where id = v_uid;

  -- El alta administrativa la crea `provision_admin_professional`; la del
  -- asistente se quedaba sin plantilla, y sin ella el paciente no puede
  -- completar el onboarding cuando le inviten.
  perform public.ensure_consent_template(v_pro);

  perform public.write_audit('professional.registered', 'professional', v_pro, v_org,
    jsonb_build_object('practice_kind', p_practice_kind, 'has_colegiado',
                       nullif(trim(p_numero_colegiado), '') is not null));
  return v_pro;
end;
$$;
revoke all on function public.register_professional(text, public.organization_kind, text, text, text) from public, anon;
grant execute on function public.register_professional(text, public.organization_kind, text, text, text) to authenticated;

/**
 * El propio contexto profesional de la cuenta.
 *
 * Existe porque `current_professional_id()` exige `app_metadata.role =
 * 'professional'` —un invariante de seguridad de septiembre que NO conviene
 * relajar— y un profesional pendiente de aprobación todavía no lo tiene. Sin
 * esto no podría ni consultar en qué estado está su propia solicitud.
 *
 * Devuelve SOLO datos de la propia cuenta. No expone nada de nadie más.
 */
create or replace function public.my_professional_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
      'professional_id',     p.id,
      'full_name',           p.full_name,
      'verification_status', p.verification_status,
      'verification_note',   p.verification_note,
      'practice_kind',       p.practice_kind,
      'colegio',             p.colegio,
      'numero_colegiado',    p.numero_colegiado,
      'organization_id',     o.id,
      'organization_name',   o.name,
      'organization_kind',   o.kind,
      'organization_role',   m.role,
      'access_status',       a.status)
    from public.professionals p
    left join public.organization_members m
      on m.professional_id = p.id and m.status = 'active'
    left join public.organizations o on o.id = m.organization_id
    left join public.organization_access a on a.organization_id = o.id
   where p.user_id = auth.uid()
   order by case when m.role = 'owner' then 0 else 1 end
   limit 1
$$;
revoke all on function public.my_professional_context() from public, anon;
grant execute on function public.my_professional_context() to authenticated;

-- =============================================================================
-- Administración de plataforma
-- =============================================================================

/** Aprueba o rechaza una acreditación profesional. Solo administradores. */
create or replace function public.admin_review_professional(
  p_professional_id uuid,
  p_status          public.verification_status,
  p_note            text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo un administrador de plataforma puede revisar acreditaciones'
      using errcode = 'P0102';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Estado de revisión no válido' using errcode = 'P0103';
  end if;

  update public.professionals
     set verification_status = p_status,
         verification_note = p_note,
         verification_reviewed_by = auth.uid(),
         verification_reviewed_at = now()
   where id = p_professional_id
  returning user_id into v_user;

  if v_user is null then
    raise exception 'Profesional no encontrado' using errcode = 'P0104';
  end if;

  -- El rol operativo solo se concede al aprobar, y se retira al rechazar.
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role',
              case when p_status = 'approved' then 'professional'
                   else 'professional_pending' end)
   where id = v_user;

  perform public.write_audit('professional.reviewed', 'professional', p_professional_id, null,
    jsonb_build_object('status', p_status));
end;
$$;
revoke all on function public.admin_review_professional(uuid, public.verification_status, text) from public, anon;
grant execute on function public.admin_review_professional(uuid, public.verification_status, text) to authenticated;

/**
 * Estado comercial de una organización. Solo administradores.
 *
 * NO es una suscripción de pago y no cobra nada: hoy no hay facturación en el
 * producto. `beta` es una autorización explícita, con quién la concedió, cuándo
 * y hasta cuándo si procede.
 */
create or replace function public.admin_set_org_access(
  p_org        uuid,
  p_status     public.org_access_status,
  p_expires_at timestamptz default null,
  p_note       text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Solo un administrador de plataforma puede cambiar el acceso'
      using errcode = 'P0105';
  end if;

  insert into public.organization_access
    (organization_id, status, granted_by, granted_at, expires_at, note)
  values (p_org, p_status, auth.uid(),
          case when p_status = 'beta' then now() end, p_expires_at, p_note)
  on conflict (organization_id) do update
     set status = excluded.status,
         granted_by = auth.uid(),
         granted_at = case when excluded.status = 'beta' then now()
                           else public.organization_access.granted_at end,
         expires_at = excluded.expires_at,
         note = excluded.note;

  perform public.write_audit('organization.access_changed', 'organization', p_org, p_org,
    jsonb_build_object('status', p_status, 'expires_at', p_expires_at));
end;
$$;
revoke all on function public.admin_set_org_access(uuid, public.org_access_status, timestamptz, text) from public, anon;
grant execute on function public.admin_set_org_access(uuid, public.org_access_status, timestamptz, text) to authenticated;

-- =============================================================================
-- Equipo del centro
-- =============================================================================

/**
 * Invita a un profesional a un centro existente.
 *
 * Quien invita no puede conceder más de lo que tiene: un `admin` no puede
 * nombrar `owner`. Y la invitación SIEMPRE añade membresía a ESTA organización;
 * nunca crea otra.
 */
create or replace function public.issue_professional_invitation(
  p_org         uuid,
  p_email       text,
  p_token_hash  text,
  p_role        public.org_member_role default 'member',
  p_can_invite  boolean default true,
  p_ttl_hours   int default 48
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me   uuid := public.current_professional_id();
  v_mine public.org_member_role;
  v_id   uuid;
  v_recent int;
begin
  if not public.can_manage_org(p_org) then
    raise exception 'No puedes invitar profesionales a esta organización'
      using errcode = 'P0106';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'El correo es obligatorio' using errcode = 'P0107';
  end if;

  select role into v_mine from public.organization_members
   where organization_id = p_org and professional_id = v_me and status = 'active';

  -- Sin escalada: solo un propietario puede crear propietarios.
  if p_role = 'owner' and v_mine <> 'owner' then
    raise exception 'Solo un propietario puede nombrar a otro propietario'
      using errcode = 'P0108';
  end if;

  -- Límite de emisión: 20 invitaciones por organización y hora.
  select count(*) into v_recent from public.professional_invitations
   where organization_id = p_org and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Demasiadas invitaciones en la última hora' using errcode = 'P0109';
  end if;

  -- Reemitir invalida las anteriores que sigan vivas para ese correo.
  update public.professional_invitations
     set revoked_at = now()
   where organization_id = p_org and lower(email) = lower(trim(p_email))
     and accepted_at is null and revoked_at is null;

  insert into public.professional_invitations
    (organization_id, email, token_hash, role, can_invite_patients, invited_by, expires_at)
  values (p_org, lower(trim(p_email)), p_token_hash, p_role, p_can_invite, v_me,
          now() + make_interval(hours => greatest(1, least(p_ttl_hours, 336))))
  returning id into v_id;

  perform public.write_audit('org_invitation.issued', 'professional_invitation', v_id, p_org,
    jsonb_build_object('role', p_role));
  return v_id;
end;
$$;
revoke all on function public.issue_professional_invitation(uuid, text, text, public.org_member_role, boolean, int) from public, anon;
grant execute on function public.issue_professional_invitation(uuid, text, text, public.org_member_role, boolean, int) to authenticated;

/** Vista previa: qué centro invita. No consume el token. */
create or replace function public.professional_invitation_preview(p_token text)
returns table (organization_name text, role public.org_member_role, expires_at timestamptz, email text)
language sql stable security definer set search_path = '' as $$
  select o.name, i.role, i.expires_at, i.email
    from public.professional_invitations i
    join public.organizations o on o.id = i.organization_id
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
$$;
revoke all on function public.professional_invitation_preview(text) from public;
grant execute on function public.professional_invitation_preview(text) to anon, authenticated;

/**
 * Acepta la incorporación a un centro. Atómica y de un solo uso.
 *
 * Un profesional YA aprobado no repite la revisión de acreditación por entrar
 * en otro centro: se le añade la membresía y opera desde el primer momento. Uno
 * nuevo entra como miembro, pero su `verification_status` sigue mandando sobre
 * si puede abrir expedientes.
 */
create or replace function public.accept_professional_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.professional_invitations%rowtype;
  v_uid   uuid := auth.uid();
  v_email text;
  v_pro   uuid;
begin
  if v_uid is null then
    raise exception 'autenticación requerida' using errcode = 'P0110';
  end if;
  select email into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Verifica tu correo antes de aceptar' using errcode = 'P0111';
  end if;

  -- `for update` + revalidación completa: dos pestañas aceptando a la vez no
  -- pueden crear dos membresías ni reutilizar el token.
  select * into v_inv from public.professional_invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     for update;

  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null
     or v_inv.expires_at <= now() then
    raise exception 'Invitación inválida, caducada o ya utilizada' using errcode = 'P0112';
  end if;
  if lower(v_inv.email) is distinct from lower(v_email) then
    raise exception 'Esta invitación no corresponde a tu cuenta' using errcode = 'P0113';
  end if;
  -- La organización tiene que seguir existiendo al aceptar, no solo al emitir.
  if not exists (select 1 from public.organizations where id = v_inv.organization_id) then
    raise exception 'La organización ya no existe' using errcode = 'P0114';
  end if;

  select id into v_pro from public.professionals where user_id = v_uid;
  if v_pro is null then
    raise exception 'Completa tu registro profesional antes de aceptar'
      using errcode = 'P0115';
  end if;

  insert into public.organization_members
    (organization_id, professional_id, role, status, can_invite_patients, invited_by)
  values (v_inv.organization_id, v_pro, v_inv.role, 'active', v_inv.can_invite_patients, v_inv.invited_by)
  on conflict (organization_id, professional_id) do update
     set status = 'active', revoked_at = null,
         role = excluded.role, can_invite_patients = excluded.can_invite_patients;

  update public.professional_invitations
     set accepted_at = now(), accepted_by = v_pro where id = v_inv.id;

  perform public.write_audit('org_invitation.accepted', 'professional_invitation', v_inv.id,
    v_inv.organization_id, jsonb_build_object('role', v_inv.role));
  return v_inv.organization_id;
end;
$$;
revoke all on function public.accept_professional_invitation(text) from public, anon;
grant execute on function public.accept_professional_invitation(text) to authenticated;

/** Revoca una invitación de profesional aún pendiente. */
create or replace function public.revoke_professional_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.professional_invitations where id = p_id;
  if v_org is null or not public.can_manage_org(v_org) then
    raise exception 'No autorizado' using errcode = 'P0116';
  end if;
  update public.professional_invitations
     set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null;
  perform public.write_audit('org_invitation.revoked', 'professional_invitation', p_id, v_org);
end;
$$;
revoke all on function public.revoke_professional_invitation(uuid) from public, anon;
grant execute on function public.revoke_professional_invitation(uuid) to authenticated;

/** Cambia el rol y los permisos de un miembro. Protege al último propietario. */
create or replace function public.set_member_permissions(
  p_member_id uuid, p_role public.org_member_role, p_can_invite boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.organization_members%rowtype; v_mine public.org_member_role;
begin
  select * into v_m from public.organization_members where id = p_member_id for update;
  if not found or not public.can_manage_org(v_m.organization_id) then
    raise exception 'No autorizado' using errcode = 'P0117';
  end if;
  select role into v_mine from public.organization_members
   where organization_id = v_m.organization_id
     and professional_id = public.current_professional_id() and status = 'active';
  if (p_role = 'owner' or v_m.role = 'owner') and v_mine <> 'owner' then
    raise exception 'Solo un propietario puede cambiar a otro propietario'
      using errcode = 'P0118';
  end if;

  update public.organization_members
     set role = p_role, can_invite_patients = p_can_invite where id = p_member_id;

  perform public.write_audit('org_member.permissions_changed', 'organization_member',
    p_member_id, v_m.organization_id, jsonb_build_object('role', p_role, 'can_invite', p_can_invite));
end;
$$;
revoke all on function public.set_member_permissions(uuid, public.org_member_role, boolean) from public, anon;
grant execute on function public.set_member_permissions(uuid, public.org_member_role, boolean) to authenticated;

/**
 * Revoca la membresía. Retira el acceso de verdad: las asignaciones clínicas
 * de esa persona en esa organización se cierran en la misma transacción, así
 * que no queda ningún expediente accesible por una asignación huérfana.
 */
create or replace function public.revoke_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.organization_members%rowtype;
begin
  select * into v_m from public.organization_members where id = p_member_id for update;
  if not found or not public.can_manage_org(v_m.organization_id) then
    raise exception 'No autorizado' using errcode = 'P0119';
  end if;

  update public.organization_members
     set status = 'revoked', revoked_at = now() where id = p_member_id;

  update public.patient_assignments
     set revoked_at = now()
   where organization_id = v_m.organization_id
     and professional_id = v_m.professional_id
     and revoked_at is null;

  -- El disparador diferido `organization_members_guard_owner` aborta aquí si
  -- esto dejaba la organización sin propietario activo.
  perform public.write_audit('org_member.revoked', 'organization_member',
    p_member_id, v_m.organization_id);
end;
$$;
revoke all on function public.revoke_member(uuid) from public, anon;
grant execute on function public.revoke_member(uuid) to authenticated;

-- =============================================================================
-- Asignación de expedientes
-- =============================================================================

create or replace function public.assign_patient(p_patient_id uuid, p_professional_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  -- Quien asigna tiene que tener acceso clínico al expediente. Administrar el
  -- centro no basta: ese es justo el permiso que no da acceso a la historia.
  if not public.professional_owns_patient(p_patient_id) then
    raise exception 'No tienes acceso a este expediente' using errcode = 'P0120';
  end if;
  select organization_id into v_org from public.patients where id = p_patient_id;

  -- Solo a alguien del MISMO centro.
  if not exists (
    select 1 from public.organization_members m
     where m.organization_id = v_org and m.professional_id = p_professional_id
       and m.status = 'active') then
    raise exception 'Ese profesional no pertenece a la organización del expediente'
      using errcode = 'P0121';
  end if;

  insert into public.patient_assignments
    (patient_id, professional_id, organization_id, role, created_by)
  values (p_patient_id, p_professional_id, v_org, 'collaborator',
          public.current_professional_id())
  on conflict do nothing;

  perform public.write_audit('patient.assigned', 'patient', p_patient_id, v_org,
    jsonb_build_object('professional_id', p_professional_id));
end;
$$;
revoke all on function public.assign_patient(uuid, uuid) from public, anon;
grant execute on function public.assign_patient(uuid, uuid) to authenticated;

create or replace function public.unassign_patient(p_patient_id uuid, p_professional_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_role public.assignment_role;
begin
  if not public.professional_owns_patient(p_patient_id) then
    raise exception 'No tienes acceso a este expediente' using errcode = 'P0122';
  end if;
  select organization_id into v_org from public.patients where id = p_patient_id;

  select role into v_role from public.patient_assignments
   where patient_id = p_patient_id and professional_id = p_professional_id
     and revoked_at is null;
  -- El profesional de referencia no se retira: dejaría el expediente huérfano.
  if v_role = 'primary' then
    raise exception 'No se puede retirar al profesional de referencia del expediente'
      using errcode = 'P0123';
  end if;

  update public.patient_assignments set revoked_at = now()
   where patient_id = p_patient_id and professional_id = p_professional_id
     and revoked_at is null;

  perform public.write_audit('patient.unassigned', 'patient', p_patient_id, v_org,
    jsonb_build_object('professional_id', p_professional_id));
end;
$$;
revoke all on function public.unassign_patient(uuid, uuid) from public, anon;
grant execute on function public.unassign_patient(uuid, uuid) to authenticated;

-- =============================================================================
-- Invitación del paciente a su expediente
-- =============================================================================

-- Cambia la firma (añade correo y TTL), así que la anterior se retira primero.
drop function if exists public.issue_invitation(uuid, text);

/**
 * Emite la invitación de acceso a UN expediente concreto.
 *
 * Reemitir REVOCA las anteriores que siguieran vivas: el enlace viejo de un
 * buzón comprometido deja de servir en cuanto se manda uno nuevo.
 */
create or replace function public.issue_invitation(
  p_patient_id uuid,
  p_token_hash text,
  p_email      text default null,
  p_ttl_hours  int default 48
) returns table (invitation_id uuid, expires_at timestamptz, recipient text)
language plpgsql security definer set search_path = '' as $$
declare
  v_org    uuid;
  v_email  text;
  v_id     uuid;
  v_exp    timestamptz;
  v_recent int;
begin
  if not public.professional_owns_patient(p_patient_id) then
    raise exception 'No tienes acceso a este expediente' using errcode = 'P0130';
  end if;

  select p.organization_id, coalesce(nullif(trim(p_email), ''), p.email)
    into v_org, v_email
    from public.patients p where p.id = p_patient_id;

  if not public.can_invite_patients(v_org) then
    raise exception 'No tienes permiso para invitar pacientes en esta organización'
      using errcode = 'P0131';
  end if;
  if coalesce(trim(v_email), '') = '' then
    raise exception 'Hace falta el correo del paciente: solo esa dirección podrá aceptar'
      using errcode = 'P0132';
  end if;

  -- Límite: 10 emisiones por expediente y hora.
  select count(*) into v_recent from public.invitations
   where patient_id = p_patient_id and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'Demasiados envíos para este expediente en la última hora'
      using errcode = 'P0133';
  end if;

  update public.invitations set revoked_at = now()
   where patient_id = p_patient_id and accepted_at is null and revoked_at is null;

  v_exp := now() + make_interval(hours => greatest(1, least(p_ttl_hours, 336)));

  insert into public.invitations
    (professional_id, patient_id, organization_id, email, token_hash, expires_at,
     invited_by, kind)
  values ((select professional_id from public.patients where id = p_patient_id),
          p_patient_id, v_org, lower(trim(v_email)), p_token_hash, v_exp,
          public.current_professional_id(), 'patient_access')
  returning id into v_id;

  perform public.write_audit('patient_invitation.issued', 'invitation', v_id, v_org);
  return query select v_id, v_exp, lower(trim(v_email));
end;
$$;
revoke all on function public.issue_invitation(uuid, text, text, int) from public, anon;
grant execute on function public.issue_invitation(uuid, text, text, int) to authenticated;

create or replace function public.revoke_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_patient uuid; v_org uuid;
begin
  select patient_id, organization_id into v_patient, v_org
    from public.invitations where id = p_id;
  if v_patient is null or not public.professional_owns_patient(v_patient) then
    raise exception 'No autorizado' using errcode = 'P0134';
  end if;
  update public.invitations set revoked_at = now()
   where id = p_id and accepted_at is null and revoked_at is null;
  perform public.write_audit('patient_invitation.revoked', 'invitation', p_id, v_org);
end;
$$;
revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

/**
 * Vista previa pública del enlace. NO consume el token.
 *
 * Devuelve el nombre de la ORGANIZACIÓN porque el encargo pide expresamente
 * que el paciente vea qué centro le invita antes de crear su cuenta. Es un
 * cambio respecto a agosto, cuando se ocultó el nombre del profesional a
 * `anon` por ser un dato de salud por inferencia. Lo que lo hace aceptable:
 * sigue haciendo falta un token vivo de 256 bits para obtener nada, y lo que
 * se devuelve es el nombre comercial del centro, no el del profesional ni una
 * sola palabra del expediente.
 */
drop function if exists public.invitation_preview(text);
create or replace function public.invitation_preview(p_token text)
returns table (valid boolean, professional_name text, expires_at timestamptz,
               organization_name text, email text)
language sql stable security definer set search_path = '' as $$
  select true, null::text, i.expires_at, o.name, i.email
    from public.invitations i
    join public.organizations o on o.id = i.organization_id
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
$$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

/**
 * Acepta el vínculo entre la cuenta y el expediente. Atómica y de un solo uso.
 *
 * Revalida AL ACEPTAR todo lo que validó al emitir —organización, expediente,
 * vigencia, destinatario— porque entre una cosa y la otra pueden haber pasado
 * 48 horas y cualquier cosa.
 */
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.invitations%rowtype;
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'autenticación requerida' using errcode = 'P0135';
  end if;
  select email into v_email from auth.users
   where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Verifica tu correo antes de aceptar' using errcode = 'P0136';
  end if;

  select * into v_inv from public.invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     for update;

  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null
     or v_inv.expires_at <= now() then
    raise exception 'Invitación inválida, caducada o ya utilizada' using errcode = 'P0001';
  end if;

  if v_inv.email is null or lower(v_inv.email) is distinct from lower(v_email) then
    raise exception 'Esta invitación no corresponde a tu cuenta' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.organizations where id = v_inv.organization_id) then
    raise exception 'La organización ya no existe' using errcode = 'P0137';
  end if;

  -- Una cuenta no puede tener dos expedientes en el MISMO centro. En centros
  -- distintos sí, y quedan separados.
  if exists (
    select 1 from public.patients
     where user_id = v_uid and organization_id = v_inv.organization_id
       and id <> v_inv.patient_id) then
    raise exception 'Ya tienes un expediente en este centro' using errcode = 'P0003';
  end if;

  -- No se roba un expediente ya vinculado a otra cuenta.
  if exists (
    select 1 from public.patients
     where id = v_inv.patient_id and user_id is not null and user_id <> v_uid) then
    raise exception 'Esta ficha ya tiene una cuenta vinculada' using errcode = 'P0004';
  end if;

  -- `patients_guard` solo deja establecer el vínculo con la cuenta cuando esta
  -- marca está puesta, y es LOCAL a la transacción: es lo que impide que un
  -- profesional reasigne un `user_id` por PostgREST sin token ni caducidad.
  perform set_config('terapia.linking_patient', 'on', true);

  update public.patients
     set user_id = v_uid, email = coalesce(email, v_email)
   where id = v_inv.patient_id;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  perform set_config('terapia.linking_patient', 'off', true);

  perform public.write_audit('patient_invitation.accepted', 'invitation', v_inv.id,
    v_inv.organization_id);
  return v_inv.patient_id;
end;
$$;
-- `accept_invitation` NO se expone a la API, igual que desde septiembre: la
-- vinculación solo ocurre dentro de `complete_onboarding`, que antes obliga a
-- mostrar el consentimiento y comprueba que el texto firmado es el que se
-- enseñó. Exponerla aquí habría permitido vincular la cuenta saltándose el
-- consentimiento con una llamada directa a PostgREST.
revoke all on function public.accept_invitation(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding del paciente, ahora con varios expedientes posibles
--
-- Las dos funciones resolvían el expediente con
-- `where user_id = auth.uid()`, que devolvía uno cualquiera. Desde que una
-- persona puede tener expediente en dos centros eso era un cruce de datos: al
-- aceptar la invitación del centro B se habría firmado el consentimiento del
-- centro A y el expediente de B se habría quedado sin vincular.
--
-- Ahora MANDA EL TOKEN, que es lo único que identifica de qué centro se está
-- hablando. Sin token se conserva el comportamiento anterior (el expediente
-- más antiguo), que es el del paciente que ya entró alguna vez.
-- ---------------------------------------------------------------------------
create or replace function public.get_onboarding_consent(p_token text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pro uuid; t public.consent_templates%rowtype; mail text;
begin
  select email into mail from auth.users
   where id = auth.uid() and email_confirmed_at is not null;
  if mail is null then
    raise exception 'Cuenta verificada requerida';
  end if;

  if coalesce(p_token, '') <> '' then
    select i.professional_id into pro
      from public.invitations i
     where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and lower(i.email) = lower(mail)
       and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
  end if;

  if pro is null then
    select p.professional_id into pro
      from public.patients p
     where p.user_id = auth.uid() and p.status = 'active'
     order by p.created_at asc, p.id asc limit 1;
  end if;

  if pro is null then raise exception 'Invitación no disponible'; end if;

  select * into t from public.consent_templates
   where professional_id = pro and active order by version desc limit 1;
  if not found then raise exception 'No hay consentimiento activo'; end if;

  return jsonb_build_object('id', t.id, 'version', t.version, 'title', t.title,
    'body', t.body, 'hash', encode(extensions.digest(t.body, 'sha256'), 'hex'));
end;
$$;
revoke all on function public.get_onboarding_consent(text) from public, anon;
grant execute on function public.get_onboarding_consent(text) to authenticated;

create or replace function public.complete_onboarding(
  p_token text, p_template_id uuid, p_content_hash text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid; t jsonb; signed uuid;
begin
  -- Se valida el texto que se mostró ANTES de vincular nada.
  t := public.get_onboarding_consent(p_token);
  if t->>'id' is distinct from p_template_id::text
     or t->>'hash' is distinct from p_content_hash then
    raise exception 'El consentimiento ha cambiado. Recarga y revisa la nueva versión';
  end if;

  -- Con token, el expediente es EL DE ESA INVITACIÓN, no "uno de los míos".
  if coalesce(p_token, '') <> '' then
    select i.patient_id into pid from public.invitations i
     where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
    if pid is not null then
      pid := public.accept_invitation(p_token);
    end if;
  end if;

  if pid is null then
    select id into pid from public.patients
     where user_id = auth.uid() and status = 'active'
     order by created_at asc, id asc limit 1
     for update;
  end if;
  if pid is null then raise exception 'No hay expediente que vincular'; end if;

  insert into public.consents
    (professional_id, patient_id, template_id, template_version, accepted,
     content_hash, content_body, signed_at)
  select professional_id, pid, p_template_id, (t->>'version')::int, true,
         p_content_hash, t->>'body', now()
    from public.patients where id = pid
  on conflict (patient_id, template_id) do nothing
  returning id into signed;

  if signed is null then
    select id into signed from public.consents
     where patient_id = pid and template_id = p_template_id;
  end if;
  return signed;
end;
$$;
revoke all on function public.complete_onboarding(text, uuid, text) from public, anon;
grant execute on function public.complete_onboarding(text, uuid, text) to authenticated;

-- --- Lectura para la administración de plataforma ----------------------------
-- La cola de acreditaciones necesita ver los perfiles profesionales. Es LO
-- ÚNICO que se le abre al administrador: ni un expediente, ni una nota, ni una
-- respuesta de escala. El acceso clínico sigue siendo por asignación, y un
-- administrador de plataforma no está asignado a nada.
drop policy if exists professionals_select_platform_admin on public.professionals;
create policy professionals_select_platform_admin on public.professionals
  for select to authenticated using ((select public.is_platform_admin()));

drop policy if exists organization_members_select_platform_admin on public.organization_members;
create policy organization_members_select_platform_admin on public.organization_members
  for select to authenticated using ((select public.is_platform_admin()));

-- --- Permisos de API ---------------------------------------------------------
grant select on table public.professional_invitations to authenticated;
grant all on table public.professional_invitations, public.email_deliveries to service_role;

commit;
