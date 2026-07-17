-- =============================================================================
-- Sesión 1 · Bloque 3: tareas
-- =============================================================================

create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  title            text not null,
  description      text,
  due_date         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index tasks_professional_id_idx on public.tasks (professional_id);
create index tasks_patient_id_idx on public.tasks (patient_id);

create table public.task_completions (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks (id) on delete cascade,
  patient_id     uuid not null references public.patients (id) on delete cascade,
  response_text  text,
  completed_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index task_completions_task_id_idx on public.task_completions (task_id);
create index task_completions_patient_id_idx on public.task_completions (patient_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.tasks            enable row level security;
alter table public.task_completions enable row level security;

-- tasks: profesional gestiona; paciente solo lee las suyas.
create policy tasks_all_by_professional on public.tasks
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy tasks_select_by_patient on public.tasks
  for select to authenticated
  using (patient_id = public.current_patient_id());

-- task_completions: el paciente crea/lee las suyas; el profesional las lee.
create policy task_completions_select_by_patient on public.task_completions
  for select to authenticated
  using (patient_id = public.current_patient_id());
create policy task_completions_insert_by_patient on public.task_completions
  for insert to authenticated
  with check (
    patient_id = public.current_patient_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.patient_id = public.current_patient_id()
    )
  );
create policy task_completions_select_by_professional on public.task_completions
  for select to authenticated
  using (public.professional_owns_patient(patient_id));
