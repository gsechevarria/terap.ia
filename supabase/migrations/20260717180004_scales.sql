-- =============================================================================
-- Sesión 1 · Bloque 4: escalas clínicas (OPT-IN)
--   scales (catálogo JSONB versionado), scale_assignments (activación por
--   paciente), scale_responses (respuestas + puntuación por trigger).
-- Decisión v2: sin un scale_assignment activo, el paciente NO ve ni puede
-- responder ninguna escala. El trigger SOLO calcula y clasifica severidad con
-- rangos estándar publicados; NO interpreta ni recomienda.
-- =============================================================================

-- Catálogo global de escalas -------------------------------------------------
create table public.scales (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  version      int  not null default 1,
  name         text not null,
  description  text,
  definition   jsonb not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (code, version)
);

-- Activación por paciente (opt-in: puntual o recurrente) --------------------
create table public.scale_assignments (
  id                        uuid primary key default gen_random_uuid(),
  professional_id           uuid not null references public.professionals (id) on delete cascade,
  patient_id                uuid not null references public.patients (id) on delete cascade,
  scale_id                  uuid not null references public.scales (id),
  assignment_type           public.assignment_type not null default 'one_off',
  recurrence_interval_days  int,
  starts_on                 date not null default current_date,
  ends_on                   date,
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint recurring_needs_interval check (
    assignment_type <> 'recurring' or recurrence_interval_days is not null
  )
);
create index scale_assignments_professional_id_idx on public.scale_assignments (professional_id);
create index scale_assignments_patient_id_idx on public.scale_assignments (patient_id);

-- Respuestas (puntuación y severidad calculadas por trigger) ----------------
create table public.scale_responses (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.scale_assignments (id) on delete cascade,
  patient_id     uuid not null references public.patients (id) on delete cascade,
  scale_id       uuid not null references public.scales (id),
  answers        jsonb not null,
  score          int,
  severity       text,
  flagged        boolean not null default false,
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index scale_responses_assignment_id_idx on public.scale_responses (assignment_id);
create index scale_responses_patient_id_idx on public.scale_responses (patient_id);

create trigger scale_assignments_set_updated_at
  before update on public.scale_assignments
  for each row execute function public.set_updated_at();

-- Trigger de puntuación ------------------------------------------------------
-- Suma los ítems, clasifica la severidad según los rangos de la definición y
-- marca (flagged) el ítem crítico si procede (p. ej. PHQ-9 ítem 9 > 0).
-- Es cálculo/clasificación descriptiva: no genera interpretación ni consejo.
create or replace function public.compute_scale_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_def            jsonb;
  v_total          int := 0;
  v_sev            text;
  v_flag_item      int;
  v_flag_threshold int;
  v_flag_val       int;
begin
  select definition into v_def from public.scales where id = new.scale_id;
  if v_def is null then
    raise exception 'Escala % no encontrada', new.scale_id;
  end if;

  -- Suma de valores por ítem. answers = {"1":2,"2":1,...}
  select coalesce(sum(v::int), 0) into v_total
  from jsonb_each_text(new.answers) as a(k, v);
  new.score := v_total;

  -- Severidad por rango estándar publicado (solo clasifica).
  select (s.value ->> 'label') into v_sev
  from jsonb_array_elements(v_def -> 'scoring' -> 'severity') as s
  where v_total between (s.value ->> 'min')::int and (s.value ->> 'max')::int
  limit 1;
  new.severity := v_sev;

  -- Ítem crítico (solo marca, no interpreta).
  v_flag_item := (v_def ->> 'flag_item')::int;
  if v_flag_item is not null then
    v_flag_threshold := coalesce((v_def ->> 'flag_threshold')::int, 1);
    v_flag_val := coalesce((new.answers ->> v_flag_item::text)::int, 0);
    new.flagged := v_flag_val >= v_flag_threshold;
  else
    new.flagged := false;
  end if;

  return new;
end;
$$;

create trigger scale_responses_compute
  before insert or update on public.scale_responses
  for each row execute function public.compute_scale_response();

-- =============================================================================
-- Seed del catálogo: PHQ-9 y GAD-7 (v1). Opciones 0-3 estándar.
-- =============================================================================
insert into public.scales (code, version, name, description, definition) values
(
  'PHQ-9', 1, 'PHQ-9',
  'Cuestionario de salud del paciente (depresión), 9 ítems.',
  '{
    "options": [
      {"value": 0, "label": "Nunca"},
      {"value": 1, "label": "Varios días"},
      {"value": 2, "label": "Más de la mitad de los días"},
      {"value": 3, "label": "Casi todos los días"}
    ],
    "items": [
      {"id": 1, "text": "Poco interés o placer en hacer las cosas"},
      {"id": 2, "text": "Sentirse desanimado/a, deprimido/a o sin esperanza"},
      {"id": 3, "text": "Problemas para dormir o dormir demasiado"},
      {"id": 4, "text": "Sentirse cansado/a o con poca energía"},
      {"id": 5, "text": "Poco apetito o comer en exceso"},
      {"id": 6, "text": "Sentirse mal consigo mismo/a, o sentir que es un fracaso o que ha decepcionado a su familia"},
      {"id": 7, "text": "Dificultad para concentrarse (leer, ver la televisión)"},
      {"id": 8, "text": "Moverse o hablar tan despacio que otras personas lo han notado; o lo contrario, estar inquieto/a o agitado/a"},
      {"id": 9, "text": "Pensamientos de que estaría mejor muerto/a o de hacerse daño de alguna forma"}
    ],
    "scoring": {
      "method": "sum",
      "min": 0,
      "max": 27,
      "severity": [
        {"min": 0,  "max": 4,  "label": "Mínima"},
        {"min": 5,  "max": 9,  "label": "Leve"},
        {"min": 10, "max": 14, "label": "Moderada"},
        {"min": 15, "max": 19, "label": "Moderadamente grave"},
        {"min": 20, "max": 27, "label": "Grave"}
      ]
    },
    "flag_item": 9,
    "flag_threshold": 1
  }'::jsonb
),
(
  'GAD-7', 1, 'GAD-7',
  'Escala de trastorno de ansiedad generalizada, 7 ítems.',
  '{
    "options": [
      {"value": 0, "label": "Nunca"},
      {"value": 1, "label": "Varios días"},
      {"value": 2, "label": "Más de la mitad de los días"},
      {"value": 3, "label": "Casi todos los días"}
    ],
    "items": [
      {"id": 1, "text": "Sentirse nervioso/a, ansioso/a o muy alterado/a"},
      {"id": 2, "text": "No poder dejar de preocuparse o no poder controlar la preocupación"},
      {"id": 3, "text": "Preocuparse demasiado por diferentes cosas"},
      {"id": 4, "text": "Dificultad para relajarse"},
      {"id": 5, "text": "Estar tan inquieto/a que resulta difícil quedarse quieto/a"},
      {"id": 6, "text": "Molestarse o irritarse fácilmente"},
      {"id": 7, "text": "Sentir miedo como si algo terrible fuera a suceder"}
    ],
    "scoring": {
      "method": "sum",
      "min": 0,
      "max": 21,
      "severity": [
        {"min": 0,  "max": 4,  "label": "Mínima"},
        {"min": 5,  "max": 9,  "label": "Leve"},
        {"min": 10, "max": 14, "label": "Moderada"},
        {"min": 15, "max": 21, "label": "Grave"}
      ]
    }
  }'::jsonb
);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.scales            enable row level security;
alter table public.scale_assignments enable row level security;
alter table public.scale_responses   enable row level security;

-- Catálogo: legible por cualquier usuario autenticado; escritura solo admin
-- (service_role, sin política -> denegado para authenticated).
create policy scales_select_authenticated on public.scales
  for select to authenticated
  using (true);

-- Asignaciones: el profesional gestiona; el paciente ve las suyas (para saber
-- qué escalas tiene activas).
create policy scale_assignments_all_by_professional on public.scale_assignments
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy scale_assignments_select_by_patient on public.scale_assignments
  for select to authenticated
  using (patient_id = public.current_patient_id());

-- Respuestas: el paciente solo puede responder si TIENE una asignación activa
-- (refuerzo del opt-in a nivel de escritura). Lee las suyas; el profesional
-- las lee.
create policy scale_responses_insert_by_patient on public.scale_responses
  for insert to authenticated
  with check (
    patient_id = public.current_patient_id()
    and exists (
      select 1 from public.scale_assignments sa
      where sa.id = assignment_id
        and sa.patient_id = public.current_patient_id()
        and sa.active
    )
  );
create policy scale_responses_select_by_patient on public.scale_responses
  for select to authenticated
  using (patient_id = public.current_patient_id());
create policy scale_responses_select_by_professional on public.scale_responses
  for select to authenticated
  using (public.professional_owns_patient(patient_id));
