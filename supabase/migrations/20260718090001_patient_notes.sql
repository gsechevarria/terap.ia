-- =============================================================================
-- Sesión 2 · Notas rápidas del profesional sobre el paciente
--   Notas clínicas privadas del profesional: el paciente NO tiene acceso.
-- =============================================================================

create table public.patient_notes (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  body             text not null,
  created_at       timestamptz not null default now()
);
create index patient_notes_patient_id_idx on public.patient_notes (patient_id);

alter table public.patient_notes enable row level security;

-- Solo el profesional dueño del paciente. El with_check ya incluye el
-- endurecimiento (professional_owns_patient) desde el inicio.
create policy patient_notes_all_by_professional on public.patient_notes
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );
