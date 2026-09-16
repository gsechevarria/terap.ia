-- =============================================================================
-- Organizaciones, verificación profesional, administración y acceso comercial
--
-- La unidad de aislamiento y de venta pasa a ser la ORGANIZACIÓN: una consulta
-- individual es una organización con un profesional; un centro, una con varios.
-- Nada de esto cambia todavía dónde vive el dato clínico: eso es la migración
-- siguiente. Aquí se levanta el andamiaje y se conserva el acceso existente.
--
-- Separación deliberada de conceptos, que el modelo anterior tenía fundidos:
--
--   auth.users                cuenta e identidad autenticada
--   professionals             perfil profesional + estado de VERIFICACIÓN
--   organizations             la consulta o el centro
--   organization_members      pertenencia y permisos ADMINISTRATIVOS
--   organization_access       estado COMERCIAL (beta hoy, suscripción mañana)
--   platform_admins           quién puede aprobar altas y conceder beta
--   audit_log                 rastro de las decisiones, sin contenido clínico
--
-- El permiso administrativo (gestionar el centro, el equipo, la facturación)
-- NO concede acceso clínico. El acceso clínico se concede por asignación a un
-- expediente concreto, y eso vive en la migración siguiente.
-- =============================================================================

begin;

-- --- Tipos -------------------------------------------------------------------
do $$ begin
  create type public.organization_kind as enum ('solo', 'center');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.org_member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'revoked');
exception when duplicate_object then null; end $$;

-- `provisional` = OPERA, PERO SU ACREDITACIÓN NO SE HA COMPROBADO.
--
-- Cubre dos casos que comparten exactamente esa propiedad: las cuentas que ya
-- existían antes de que hubiera revisión, y las que crea un administrador con
-- `service_role` (el alta documentada en CLAUDE.md). En ambos hubo un acto
-- humano deliberado —por eso operan y no se les corta el acceso, que sería una
-- regresión para usuarios legítimos— pero nadie comprobó un número de
-- colegiado. Por eso NO se presentan como verificadas en ninguna pantalla y
-- aparecen en la cola del administrador para revisión retroactiva.
--
-- `approved` es lo único que la interfaz puede llamar "verificado", y solo
-- llega ahí por una decisión explícita de un administrador de plataforma.
do $$ begin
  create type public.verification_status as enum
    ('pending', 'approved', 'rejected', 'provisional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.org_access_status as enum ('pending', 'beta', 'suspended');
exception when duplicate_object then null; end $$;

-- --- Organizaciones ----------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        public.organization_kind not null default 'solo',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- --- Membresía ---------------------------------------------------------------
-- `role` es la dimensión ADMINISTRATIVA. `can_invite_patients` es lo único
-- operativo que se delega aquí; el acceso a expedientes va por asignación.
create table if not exists public.organization_members (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  professional_id     uuid not null references public.professionals (id) on delete cascade,
  role                public.org_member_role not null default 'member',
  status              public.member_status not null default 'active',
  can_invite_patients boolean not null default true,
  invited_by          uuid references public.professionals (id) on delete set null,
  created_at          timestamptz not null default now(),
  revoked_at          timestamptz,
  unique (organization_id, professional_id)
);
create index if not exists organization_members_professional_idx
  on public.organization_members (professional_id) where status = 'active';
create index if not exists organization_members_org_idx
  on public.organization_members (organization_id) where status = 'active';

-- Una organización no puede quedarse sin propietario activo. El disparador es
-- la red: las operaciones de equipo van por RPC y ya lo comprueban, pero una
-- escritura directa con `service_role` también pasaría por aquí.
create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_owners int;
begin
  select count(*) into v_owners
    from public.organization_members
   where organization_id = v_org and role = 'owner' and status = 'active';
  if v_owners = 0 then
    raise exception 'La organización se quedaría sin propietario activo'
      using errcode = 'P0010';
  end if;
  return null;
end;
$$;

drop trigger if exists organization_members_guard_owner on public.organization_members;
create constraint trigger organization_members_guard_owner
  after update or delete on public.organization_members
  deferrable initially deferred
  for each row execute function public.guard_last_owner();

-- --- Acceso comercial --------------------------------------------------------
-- Separado de la autenticación y de la autorización clínica a propósito: que
-- una organización no tenga beta concedida no puede convertirse nunca en un
-- corte del acceso del paciente a sus propios datos.
--
-- Hoy NO hay cobro. Las dos columnas de Stripe existen para que incorporarlo
-- después no obligue a rehacer el registro; ningún código las lee ni escribe.
create table if not exists public.organization_access (
  organization_id        uuid primary key references public.organizations (id) on delete cascade,
  status                 public.org_access_status not null default 'pending',
  granted_by             uuid references auth.users (id) on delete set null,
  granted_at             timestamptz,
  expires_at             timestamptz,
  note                   text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  updated_at             timestamptz not null default now()
);

drop trigger if exists organization_access_set_updated_at on public.organization_access;
create trigger organization_access_set_updated_at
  before update on public.organization_access
  for each row execute function public.set_updated_at();

-- --- Administradores de plataforma -------------------------------------------
-- NACE VACÍA Y ASÍ SE QUEDA. No hay administrador por defecto, no se puede
-- llegar a esta tabla desde la aplicación (no tiene ni una política de RLS, y
-- no se concede ningún permiso de API), y nadie puede autoasignarse el rol.
-- El alta del primero se hace fuera de banda con `service_role`:
-- `node scripts/alta-admin-plataforma.mjs <email>`.
create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;

-- --- Auditoría ---------------------------------------------------------------
-- Rastro de decisiones: altas, aprobaciones, invitaciones, aceptaciones,
-- revocaciones y cambios de permisos. NUNCA contenido clínico ni secretos:
-- `metadata` guarda identificadores y estados, jamás notas, respuestas de
-- escalas ni tokens.
create table if not exists public.audit_log (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  actor_user_id   uuid,
  organization_id uuid,
  action          text not null,
  subject_type    text,
  subject_id      uuid,
  metadata        jsonb not null default '{}'
);
create index if not exists audit_log_org_idx on public.audit_log (organization_id, occurred_at desc);
create index if not exists audit_log_subject_idx on public.audit_log (subject_type, subject_id);

create or replace function public.write_audit(
  p_action text, p_subject_type text, p_subject_id uuid,
  p_org uuid default null, p_metadata jsonb default '{}'
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_user_id, organization_id, action, subject_type, subject_id, metadata)
  values (auth.uid(), p_org, p_action, p_subject_type, p_subject_id, coalesce(p_metadata, '{}'))
$$;
revoke all on function public.write_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- --- Verificación profesional ------------------------------------------------
-- Se amplía `professionals` en vez de crear una tabla paralela: ya es 1:1 con
-- la cuenta y duplicarla solo abriría la puerta a que ambas discrepen.
--
-- El valor por defecto es `provisional`, y es deliberado: las ÚNICAS vías que
-- insertan aquí sin decir nada son administrativas —`handle_new_user` cuando un
-- administrador ha puesto `app_metadata.role`, `provision_admin_professional`,
-- y los scripts con `service_role`—, porque desde agosto el cliente no puede
-- fijarse el rol de profesional. El asistente de registro público, que es la
-- vía sin acto humano detrás, pasa `pending` EXPLÍCITAMENTE.
--
-- Así no hace falta reescribir las dos funciones de aprovisionamiento, que
-- tienen lógica de roles propia y duplicarla solo invitaría a que divergieran.
alter table public.professionals
  add column if not exists verification_status public.verification_status,
  add column if not exists colegio                 text,
  add column if not exists numero_colegiado        text,
  add column if not exists practice_kind           public.organization_kind,
  add column if not exists verification_note       text,
  add column if not exists verification_reviewed_by  uuid references auth.users (id) on delete set null,
  add column if not exists verification_reviewed_at  timestamptz,
  add column if not exists onboarding_completed_at   timestamptz;

update public.professionals
   set verification_status = 'provisional'
 where verification_status is null;

alter table public.professionals
  alter column verification_status set default 'provisional',
  alter column verification_status set not null;

-- --- Helpers -----------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

/** Organizaciones donde el llamante es miembro ACTIVO. */
create or replace function public.current_org_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.organization_id
    from public.organization_members m
   where m.professional_id = public.current_professional_id()
     and m.status = 'active'
$$;

/** ¿Puede administrar la organización? (propietario o administrador.) */
create or replace function public.can_manage_org(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.professional_id = public.current_professional_id()
       and m.status = 'active'
       and m.role in ('owner', 'admin')
  )
$$;

/** ¿Es miembro activo de la organización? */
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.professional_id = public.current_professional_id()
       and m.status = 'active'
  )
$$;

/**
 * ¿Está el profesional habilitado para operar clínicamente?
 *
 * `provisional` cuenta como habilitado a propósito: son las cuentas creadas
 * por un administrador o preexistentes, a las que no se les puede cortar el
 * acceso por haber añadido después una revisión que entonces no existía. NO
 * cuenta como "verificado" en ninguna pantalla.
 */
create or replace function public.professional_is_operational()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professionals p
     where p.user_id = auth.uid()
       and p.verification_status in ('approved', 'provisional')
  )
$$;

/**
 * ¿Puede invitar pacientes en esta organización?
 *
 * Exige las tres cosas a la vez: membresía activa, permiso explícito de quien
 * administra el centro, y acreditación resuelta. Un profesional pendiente de
 * revisión no invita a nadie.
 */
create or replace function public.can_invite_patients(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.professional_is_operational() and exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.professional_id = public.current_professional_id()
       and m.status = 'active'
       and (m.can_invite_patients or m.role in ('owner', 'admin'))
  )
$$;

-- --- RLS ---------------------------------------------------------------------
alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_access enable row level security;
alter table public.audit_log           enable row level security;

-- Organizaciones: las ve quien es miembro. Escribir, solo quien administra —y
-- el alta va por RPC, que es donde se garantiza que hay un propietario.
drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (id in (select public.current_org_ids()) or (select public.is_platform_admin()));

drop policy if exists organizations_update_manager on public.organizations;
create policy organizations_update_manager on public.organizations
  for update to authenticated
  using (public.can_manage_org(id))
  with check (public.can_manage_org(id));

-- Membresías: visibles para el equipo del centro. Las altas, bajas y cambios
-- de permisos van por RPC (invariante de propietario + auditoría), así que no
-- hay política de escritura.
drop policy if exists organization_members_select_team on public.organization_members;
create policy organization_members_select_team on public.organization_members
  for select to authenticated
  using (
    organization_id in (select public.current_org_ids())
    or (select public.is_platform_admin())
  );

-- Acceso comercial: el equipo lo consulta; solo el administrador de plataforma
-- lo cambia, y lo hace por RPC para dejar rastro de quién y cuándo.
drop policy if exists organization_access_select_member on public.organization_access;
create policy organization_access_select_member on public.organization_access
  for select to authenticated
  using (
    organization_id in (select public.current_org_ids())
    or (select public.is_platform_admin())
  );

-- Auditoría: el equipo ve la de su organización; el administrador, toda. La
-- escritura es exclusiva de `write_audit` (SECURITY DEFINER).
drop policy if exists audit_log_select_scope on public.audit_log;
create policy audit_log_select_scope on public.audit_log
  for select to authenticated
  using (
    (organization_id is not null and public.can_manage_org(organization_id))
    or (select public.is_platform_admin())
  );

-- --- Permisos de API ---------------------------------------------------------
-- Explícitos, como el resto del esquema desde 20260911090001.
grant select on table public.organizations, public.organization_members,
  public.organization_access, public.audit_log to authenticated;
grant update on table public.organizations to authenticated;
grant all on table public.organizations, public.organization_members,
  public.organization_access, public.audit_log, public.platform_admins
  to service_role;
grant usage, select on all sequences in schema public to service_role;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_org_ids() to authenticated;
grant execute on function public.can_manage_org(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.professional_is_operational() to authenticated;
grant execute on function public.can_invite_patients(uuid) to authenticated;

commit;
