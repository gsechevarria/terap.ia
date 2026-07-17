-- =============================================================================
-- Sesión 1 · Bloque 6: seguimiento de pagos (SIN facturación)
--   Decisión v2: se registran precios, pagos, bonos y deuda; la app NUNCA
--   emite facturas. No hay tablas ni campos de facturación (evita Veri*factu).
--   Importes en céntimos (int) para evitar errores de coma flotante.
-- =============================================================================

-- Precio por paciente / tipo de sesión. patient_id NULL = tarifa por defecto
-- del profesional.
create table public.payment_settings (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid references public.patients (id) on delete cascade,
  session_type     text not null default 'individual',
  price_cents      int not null check (price_cents >= 0),
  currency         text not null default 'EUR',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (professional_id, patient_id, session_type)
);
create index payment_settings_professional_id_idx on public.payment_settings (professional_id);
create index payment_settings_patient_id_idx on public.payment_settings (patient_id);

-- Bonos (packs de 5/10 sesiones) con consumo.
create table public.session_packs (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  total_sessions   int not null check (total_sessions > 0),
  used_sessions    int not null default 0 check (used_sessions >= 0),
  price_cents      int check (price_cents >= 0),
  currency         text not null default 'EUR',
  active           boolean not null default true,
  purchased_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint pack_not_overused check (used_sessions <= total_sessions)
);
create index session_packs_professional_id_idx on public.session_packs (professional_id);
create index session_packs_patient_id_idx on public.session_packs (patient_id);

-- Pagos (pagado/pendiente), opcionalmente vinculados a una cita y/o bono.
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  appointment_id   uuid references public.appointments (id) on delete set null,
  session_pack_id  uuid references public.session_packs (id) on delete set null,
  amount_cents     int not null check (amount_cents >= 0),
  currency         text not null default 'EUR',
  status           public.payment_status not null default 'pending',
  method           text,
  paid_at          timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index payments_professional_id_idx on public.payments (professional_id);
create index payments_patient_id_idx on public.payments (patient_id);
create index payments_appointment_id_idx on public.payments (appointment_id);

create trigger payment_settings_set_updated_at
  before update on public.payment_settings
  for each row execute function public.set_updated_at();
create trigger session_packs_set_updated_at
  before update on public.session_packs
  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.payment_settings enable row level security;
alter table public.session_packs    enable row level security;
alter table public.payments         enable row level security;

-- El profesional gestiona todo; el paciente ve lo suyo (deuda, bono restante).
create policy payment_settings_all_by_professional on public.payment_settings
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy payment_settings_select_by_patient on public.payment_settings
  for select to authenticated
  using (patient_id = public.current_patient_id());

create policy session_packs_all_by_professional on public.session_packs
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy session_packs_select_by_patient on public.session_packs
  for select to authenticated
  using (patient_id = public.current_patient_id());

create policy payments_all_by_professional on public.payments
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy payments_select_by_patient on public.payments
  for select to authenticated
  using (patient_id = public.current_patient_id());
