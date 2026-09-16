-- =============================================================================
-- El expediente pasa a pertenecer a una organización, y el acceso clínico a
-- concederse por asignación explícita.
--
-- Qué cambia de verdad:
--
--   · `patients` gana `organization_id`. Sigue siendo EL EXPEDIENTE: no se
--     renombra ni se parte, porque 30 tablas y 62 políticas cuelgan de él y
--     partirlo habría sido una migración destructiva a cambio de nada.
--   · `patient_assignments` es la nueva fuente de verdad del acceso clínico.
--     Pertenecer a un centro NO da acceso a sus expedientes; estar asignado sí.
--   · `patients.professional_id` se conserva como profesional de referencia
--     (quién lo dio de alta y quién responde por él). Ya no es, por sí solo,
--     la llave de acceso.
--
-- NADA SE BORRA. Ni tablas, ni expedientes, ni cuentas, ni vínculos. El
-- backfill es repetible: se salta lo que ya esté hecho.
--
-- Una persona puede tener expediente en varios centros, y esos expedientes son
-- independientes: filas distintas, datos distintos, sin mezcla ninguna. Por eso
-- desaparece el índice que obligaba a un expediente por cuenta.
-- =============================================================================

begin;

do $$ begin
  create type public.assignment_role as enum ('primary', 'collaborator');
exception when duplicate_object then null; end $$;

-- --- 1. El expediente pertenece a una organización ---------------------------
alter table public.patients
  add column if not exists organization_id uuid references public.organizations (id) on delete restrict;

-- --- 2. Asignación de profesionales a expedientes ----------------------------
create table if not exists public.patient_assignments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role            public.assignment_role not null default 'collaborator',
  created_by      uuid references public.professionals (id) on delete set null,
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz
);
create unique index if not exists patient_assignments_unique_active
  on public.patient_assignments (patient_id, professional_id)
  where revoked_at is null;
create index if not exists patient_assignments_professional_idx
  on public.patient_assignments (professional_id) where revoked_at is null;
create index if not exists patient_assignments_patient_idx
  on public.patient_assignments (patient_id) where revoked_at is null;

-- --- 3. Backfill ------------------------------------------------------------
-- Cada profesional existente pasa a tener su consulta individual, de la que es
-- propietario. Es la lectura inequívoca del modelo anterior: un profesional,
-- sus pacientes, sin nadie más. No se inventa ninguna agrupación en centros.
insert into public.organizations (id, name, kind, created_by, created_at)
select gen_random_uuid(),
       coalesce(nullif(trim(p.full_name), ''), 'Consulta'),
       'solo',
       p.user_id,
       p.created_at
  from public.professionals p
 where not exists (
   select 1 from public.organization_members m where m.professional_id = p.id
 );

-- Membresía de propietario para cada profesional en la organización recién
-- creada. El emparejamiento se hace por `created_by`, que es único por
-- profesional (`professionals.user_id` es unique).
insert into public.organization_members (organization_id, professional_id, role, status, can_invite_patients)
select o.id, p.id, 'owner', 'active', true
  from public.professionals p
  join public.organizations o on o.created_by = p.user_id and o.kind = 'solo'
 where not exists (
   select 1 from public.organization_members m where m.professional_id = p.id
 );

-- Estado comercial inicial: `pending`. NO es un bloqueo — ver la nota de
-- `organization_access`: hoy no hay cobro y `pending` no corta nada. El beta
-- lo concede el administrador de plataforma, explícitamente y con rastro.
insert into public.organization_access (organization_id, status)
select o.id, 'pending' from public.organizations o
 where not exists (
   select 1 from public.organization_access a where a.organization_id = o.id
 );

-- El expediente hereda la organización de su profesional de referencia. La
-- relación es inequívoca: `patients.professional_id` es NOT NULL y apunta a un
-- único profesional, que ahora tiene exactamente una organización.
update public.patients pa
   set organization_id = m.organization_id
  from public.organization_members m
 where m.professional_id = pa.professional_id
   and m.status = 'active'
   and pa.organization_id is null;

-- El profesional de referencia queda asignado a su expediente. Sin esto, el
-- cambio de llave de acceso dejaría a todo el mundo fuera de sus propios datos.
insert into public.patient_assignments (patient_id, professional_id, organization_id, role, created_at)
select pa.id, pa.professional_id, pa.organization_id, 'primary', pa.created_at
  from public.patients pa
 where pa.organization_id is not null
   and not exists (
     select 1 from public.patient_assignments a
      where a.patient_id = pa.id and a.professional_id = pa.professional_id
        and a.revoked_at is null
   );

-- Si algún expediente se hubiera quedado sin organización, la migración PARA.
-- Es exactamente el caso que no se debe resolver inventando una asignación.
do $$
declare v_huerfanos int;
begin
  select count(*) into v_huerfanos from public.patients where organization_id is null;
  if v_huerfanos > 0 then
    raise exception
      'Hay % expediente(s) sin organización derivable. No se asigna ninguno a ciegas: revisar con scripts/informe-migracion-organizaciones.mjs',
      v_huerfanos;
  end if;
end $$;

alter table public.patients alter column organization_id set not null;
create index if not exists patients_organization_idx on public.patients (organization_id);

-- --- 3 bis. Que nunca vuelva a haber un profesional sin organización --------
-- Todo profesional nuevo nace con su consulta individual, de la que es
-- propietario. El asistente de registro RENOMBRA y RECLASIFICA esta misma
-- organización si el alta era de un centro; así un registro interrumpido y
-- reintentado no deja dos organizaciones ni dos membresías.
create or replace function public.ensure_solo_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if exists (select 1 from public.organization_members where professional_id = new.id) then
    return null;
  end if;
  insert into public.organizations (name, kind, created_by)
  values (coalesce(nullif(trim(new.full_name), ''), 'Consulta'), 'solo', new.user_id)
  returning id into v_org;
  insert into public.organization_members (organization_id, professional_id, role, status)
  values (v_org, new.id, 'owner', 'active');
  insert into public.organization_access (organization_id, status)
  values (v_org, 'pending')
  on conflict (organization_id) do nothing;
  return null;
end;
$$;

drop trigger if exists professionals_ensure_org on public.professionals;
create trigger professionals_ensure_org
  after insert on public.professionals
  for each row execute function public.ensure_solo_organization();

-- El expediente hereda la organización de su profesional de referencia cuando
-- quien lo crea no la indica. Es lo que mantiene funcionando sin cambios el
-- alta de pacientes que ya existía, y evita que un descuido deje el expediente
-- fuera de toda organización.
create or replace function public.patients_set_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if new.organization_id is null then
    select m.organization_id into v_org
      from public.organization_members m
     where m.professional_id = new.professional_id and m.status = 'active'
     order by case when m.role = 'owner' then 0 else 1 end, m.created_at
     limit 1;
    if v_org is null then
      raise exception 'El profesional no pertenece a ninguna organización activa'
        using errcode = 'P0011';
    end if;
    new.organization_id := v_org;
  end if;
  return new;
end;
$$;

drop trigger if exists patients_set_organization on public.patients;
create trigger patients_set_organization
  before insert on public.patients
  for each row execute function public.patients_set_organization();

-- Y queda asignado a quien lo da de alta. Sin esto, crear un paciente y perder
-- el acceso a él en el mismo gesto.
create or replace function public.patients_primary_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.patient_assignments
    (patient_id, professional_id, organization_id, role)
  values (new.id, new.professional_id, new.organization_id, 'primary')
  on conflict do nothing;
  return null;
end;
$$;

drop trigger if exists patients_primary_assignment on public.patients;
create trigger patients_primary_assignment
  after insert on public.patients
  for each row execute function public.patients_primary_assignment();

-- --- 4. Un expediente por cuenta deja de ser cierto --------------------------
-- La misma persona puede ser paciente de dos centros. Sus expedientes son
-- independientes y NO se fusionan: son filas distintas, cada una en su
-- organización. Lo que sigue prohibido es tener dos expedientes en el MISMO
-- centro con la misma cuenta.
-- Dos cosas obligaban a un expediente por cuenta, y hay que quitar las dos: el
-- índice parcial del endurecimiento de julio Y la restricción `unique` de la
-- propia columna, que viene de la definición original de la tabla.
drop index if exists public.patients_user_id_unique;
alter table public.patients drop constraint if exists patients_user_id_key;
create unique index if not exists patients_user_org_unique
  on public.patients (user_id, organization_id) where user_id is not null;

-- --- 5. Helpers: el acceso clínico pasa a ser por asignación -----------------

/**
 * Expedientes a los que el llamante está clínicamente asignado.
 *
 * Tres condiciones a la vez, y las tres importan:
 *   · asignación viva sobre ese expediente,
 *   · membresía activa en la organización del expediente —revocar la membresía
 *     retira el acceso aunque la asignación siguiera ahí—,
 *   · acreditación resuelta: un profesional pendiente de revisión no abre
 *     ningún expediente.
 */
create or replace function public.current_clinical_patient_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select a.patient_id
    from public.patient_assignments a
    join public.organization_members m
      on m.organization_id = a.organization_id
     and m.professional_id = a.professional_id
     and m.status = 'active'
   where a.professional_id = public.current_professional_id()
     and a.revoked_at is null
     and public.professional_is_operational()
$$;

-- Cambia de "es mi paciente porque lo creé yo" a "estoy asignado a él". Para
-- una consulta individual el resultado es idéntico; para un centro es la
-- diferencia entre ver un expediente y no verlo.
create or replace function public.professional_owns_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_patient_id in (select public.current_clinical_patient_ids())
$$;

/**
 * Consentimiento vigente PARA UN EXPEDIENTE CONCRETO.
 *
 * `has_current_consent()` respondía por la cuenta entera: bastaba haber
 * firmado en un centro para que la cuenta contara como consentida en todos.
 * Con expedientes en varios centros eso habría abierto el de al lado. Conserva
 * íntegras las comprobaciones de integridad de 20260909190011 —versión, cuerpo
 * y hash de la plantilla, y que sea la última activa del profesional—.
 *
 * Única comprobación relajada: el rol de la cuenta. Antes exigía
 * `role = 'patient'`, lo que impedía que una misma persona fuese profesional en
 * un sitio y paciente en otro. El correo verificado y la titularidad del
 * expediente siguen siendo obligatorios, que es lo que de verdad protegía.
 */
create or replace function public.has_consent_for_record(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.patients p
      join auth.users u on u.id = p.user_id
      join public.consents c
        on c.patient_id = p.id and c.professional_id = p.professional_id
      join public.consent_templates t on t.id = c.template_id
     where p.id = p_patient_id
       and p.user_id = auth.uid()
       and p.status = 'active'
       and c.accepted
       and u.email_confirmed_at is not null
       and c.template_version = t.version
       and c.content_body = t.body
       and c.content_hash = encode(extensions.digest(t.body, 'sha256'), 'hex')
       and t.id = (
         select latest.id from public.consent_templates latest
          where latest.professional_id = p.professional_id and latest.active
          order by latest.version desc limit 1)
  )
$$;

/**
 * Expedientes de la propia cuenta. Devuelve un CONJUNTO porque desde esta
 * migración una persona puede tener expediente en varios centros, y cada uno
 * exige su propio consentimiento.
 */
create or replace function public.current_patient_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.patients p
   where p.user_id = auth.uid()
     and p.status = 'active'
     and public.has_consent_for_record(p.id)
$$;

/**
 * Compatibilidad: sigue devolviendo UN expediente —el más antiguo— para el
 * código y las políticas que esperan un escalar. Con varios expedientes ya no
 * basta (por eso existe `current_patient_ids()`), pero devolver el primero es
 * determinista y nunca cruza datos de otra persona.
 */
create or replace function public.current_patient_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.patients p
   where p.user_id = auth.uid()
     and p.status = 'active'
     and public.has_consent_for_record(p.id)
   order by p.created_at asc, p.id asc
   limit 1
$$;

/** Profesionales de referencia de los expedientes consentidos de la cuenta. */
create or replace function public.current_patient_professional_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.professional_id from public.patients p
   where p.user_id = auth.uid()
     and p.status = 'active'
     and public.has_consent_for_record(p.id)
$$;

create or replace function public.current_patient_professional_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.professional_id from public.patients p
   where p.user_id = auth.uid()
     and p.status = 'active'
     and public.has_consent_for_record(p.id)
   order by p.created_at asc, p.id asc
   limit 1
$$;

/** Organizaciones en las que la cuenta tiene expediente consentido. */
create or replace function public.current_patient_org_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.organization_id from public.patients p
   where p.user_id = auth.uid()
     and p.status = 'active'
     and public.has_consent_for_record(p.id)
$$;

-- --- 6. RLS de las asignaciones ---------------------------------------------
alter table public.patient_assignments enable row level security;

-- Quien administra el centro ve el reparto de expedientes (es gestión, no
-- contenido clínico: nombres de profesional y de expediente, nada más), y cada
-- profesional ve las suyas.
drop policy if exists patient_assignments_select_scope on public.patient_assignments;
create policy patient_assignments_select_scope on public.patient_assignments
  for select to authenticated
  using (
    professional_id = (select public.current_professional_id())
    or public.can_manage_org(organization_id)
  );

-- Las altas y bajas van por RPC: hay que comprobar organización, membresía y
-- permisos a la vez, y dejar rastro.

-- --- 7. Permisos de API ------------------------------------------------------
grant select on table public.patient_assignments to authenticated;
grant all on table public.patient_assignments to service_role;
grant execute on function public.has_consent_for_record(uuid) to authenticated;
grant execute on function public.current_clinical_patient_ids() to authenticated;
grant execute on function public.current_patient_ids() to authenticated;
grant execute on function public.current_patient_professional_ids() to authenticated;
grant execute on function public.current_patient_org_ids() to authenticated;

commit;
