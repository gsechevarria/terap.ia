-- =============================================================================
-- Sesión 1 · Bloque 5: agenda / citas
--   Sin videoconsulta integrada: solo un campo de texto video_link.
-- =============================================================================

create table public.appointments (
  id                     uuid primary key default gen_random_uuid(),
  professional_id        uuid not null references public.professionals (id) on delete cascade,
  patient_id             uuid not null references public.patients (id) on delete cascade,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  status                 public.appointment_status not null default 'scheduled',
  attendance             public.attendance_status not null default 'pending',
  video_link             text,
  recurrence_freq        public.recurrence_freq not null default 'none',
  recurrence_until       date,
  parent_appointment_id  uuid references public.appointments (id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint appointment_time_valid check (ends_at > starts_at)
);
create index appointments_professional_id_idx on public.appointments (professional_id);
create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_starts_at_idx on public.appointments (starts_at);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.appointments enable row level security;

-- El profesional gestiona su agenda; el paciente ve sus citas y puede
-- actualizarlas (confirmar/cancelar desde su app).
create policy appointments_all_by_professional on public.appointments
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy appointments_select_by_patient on public.appointments
  for select to authenticated
  using (patient_id = public.current_patient_id());
create policy appointments_update_by_patient on public.appointments
  for update to authenticated
  using (patient_id = public.current_patient_id())
  with check (patient_id = public.current_patient_id());
