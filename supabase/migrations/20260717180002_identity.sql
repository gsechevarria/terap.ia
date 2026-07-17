-- =============================================================================
-- Sesión 1 · Bloque 2: identidad y multi-tenant
--   professionals, patients, invitations + helpers de RLS + glue de auth
-- Modelo: cada profesional solo ve SUS pacientes y datos; cada paciente solo
-- lo suyo. El rol operativo se deriva de pertenecer a professionals/patients.
-- =============================================================================

-- professionals: 1:1 con auth.users -----------------------------------------
create table public.professionals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- patients: pertenece a un profesional; se vincula a un auth.user al aceptar
-- la invitación (user_id nulo hasta entonces).
create table public.patients (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  user_id          uuid unique references auth.users (id) on delete set null,
  full_name        text,
  email            text,
  status           public.patient_status not null default 'active',
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index patients_professional_id_idx on public.patients (professional_id);
create index patients_user_id_idx on public.patients (user_id);

-- invitations: token de un solo uso, con caducidad -------------------------
create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  email            text,
  token            text not null unique
                     default replace(gen_random_uuid()::text, '-', '')
                          || replace(gen_random_uuid()::text, '-', ''),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index invitations_professional_id_idx on public.invitations (professional_id);
create index invitations_patient_id_idx on public.invitations (patient_id);

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();
create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Helpers de RLS (SECURITY DEFINER: resuelven el mapeo auth.uid()->fila sin
-- disparar RLS, evitando recursión en las políticas).
-- =============================================================================
create or replace function public.current_professional_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.professionals where user_id = auth.uid()
$$;

create or replace function public.current_patient_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.patients where user_id = auth.uid()
$$;

create or replace function public.current_patient_professional_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select professional_id from public.patients where user_id = auth.uid()
$$;

create or replace function public.professional_owns_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patients
    where id = p_patient_id
      and professional_id = public.current_professional_id()
  )
$$;

-- =============================================================================
-- Glue con Supabase Auth
-- =============================================================================
-- Alta de profesional al registrarse (rol en metadata desde Sesión 0).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'role' = 'professional' then
    insert into public.professionals (user_id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Aceptación de invitación por el paciente: vincula su auth.user a la fila
-- patient ya creada por el profesional. Token de un solo uso y con caducidad.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations%rowtype;
begin
  select * into v_inv
  from public.invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitación inválida, caducada o ya utilizada';
  end if;

  update public.patients
     set user_id = auth.uid(),
         email = coalesce(email, (select email from auth.users where id = auth.uid()))
   where id = v_inv.patient_id;

  update public.invitations
     set accepted_at = now()
   where id = v_inv.id;

  return v_inv.patient_id;
end;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.professionals enable row level security;
alter table public.patients      enable row level security;
alter table public.invitations   enable row level security;

-- professionals: cada profesional ve/edita su propia ficha; su paciente puede
-- leerla (necesita nombre del profesional).
create policy professionals_select_self on public.professionals
  for select to authenticated
  using (user_id = auth.uid());
create policy professionals_select_by_patient on public.professionals
  for select to authenticated
  using (id = public.current_patient_professional_id());
create policy professionals_insert_self on public.professionals
  for insert to authenticated
  with check (user_id = auth.uid());
create policy professionals_update_self on public.professionals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- patients: el profesional gestiona sus pacientes; el paciente lee/actualiza
-- su propia ficha.
create policy patients_select_by_professional on public.patients
  for select to authenticated
  using (professional_id = public.current_professional_id());
create policy patients_select_self on public.patients
  for select to authenticated
  using (user_id = auth.uid());
create policy patients_insert_by_professional on public.patients
  for insert to authenticated
  with check (professional_id = public.current_professional_id());
create policy patients_update_by_professional on public.patients
  for update to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy patients_update_self on public.patients
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy patients_delete_by_professional on public.patients
  for delete to authenticated
  using (professional_id = public.current_professional_id());

-- invitations: solo el profesional dueño. (La aceptación va por la función
-- SECURITY DEFINER accept_invitation, no por acceso directo del paciente.)
create policy invitations_all_by_professional on public.invitations
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
