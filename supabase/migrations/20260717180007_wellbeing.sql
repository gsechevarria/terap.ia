-- =============================================================================
-- Sesión 1 · Bloque 7: diario emocional, recursos, documentos y consentimientos
-- =============================================================================

-- Diario emocional: SOLO registro (valor 1-5 + texto opcional). Sin campos de
-- interpretación, análisis ni recomendación (decisión v2, evita MDR).
create table public.mood_entries (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  mood_value   smallint not null check (mood_value between 1 and 5),
  note         text,
  entry_date   date not null default current_date,
  created_at   timestamptz not null default now()
);
create index mood_entries_patient_id_idx on public.mood_entries (patient_id);
create index mood_entries_entry_date_idx on public.mood_entries (entry_date);

-- Biblioteca de recursos. patient_id NULL = compartido con todos los pacientes
-- del profesional; con valor = recurso para un paciente concreto.
create table public.resources (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid references public.patients (id) on delete cascade,
  title            text not null,
  kind             public.resource_kind not null default 'link',
  url              text,
  storage_path     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index resources_professional_id_idx on public.resources (professional_id);
create index resources_patient_id_idx on public.resources (patient_id);

-- Repositorio de documentos por paciente (metadatos; binario en Storage).
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  title            text,
  storage_path     text not null,
  uploaded_by      uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index documents_professional_id_idx on public.documents (professional_id);
create index documents_patient_id_idx on public.documents (patient_id);

-- Plantilla de consentimiento del profesional (versionada).
create table public.consent_templates (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  title            text not null,
  body             text not null,
  version          int not null default 1,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index consent_templates_professional_id_idx on public.consent_templates (professional_id);

-- Firma del consentimiento por el paciente: checkbox + timestamp + hash del
-- texto firmado (integridad).
create table public.consents (
  id                uuid primary key default gen_random_uuid(),
  professional_id   uuid not null references public.professionals (id) on delete cascade,
  patient_id        uuid not null references public.patients (id) on delete cascade,
  template_id       uuid references public.consent_templates (id) on delete set null,
  template_version  int,
  accepted          boolean not null default false,
  content_hash      text,
  signed_at         timestamptz,
  created_at        timestamptz not null default now()
);
create index consents_professional_id_idx on public.consents (professional_id);
create index consents_patient_id_idx on public.consents (patient_id);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();
create trigger consent_templates_set_updated_at
  before update on public.consent_templates
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.mood_entries      enable row level security;
alter table public.resources         enable row level security;
alter table public.documents         enable row level security;
alter table public.consent_templates enable row level security;
alter table public.consents          enable row level security;

-- mood_entries: el paciente crea/gestiona lo suyo; el profesional solo lee.
create policy mood_entries_all_by_patient on public.mood_entries
  for all to authenticated
  using (patient_id = public.current_patient_id())
  with check (patient_id = public.current_patient_id());
create policy mood_entries_select_by_professional on public.mood_entries
  for select to authenticated
  using (public.professional_owns_patient(patient_id));

-- resources: el profesional gestiona; el paciente ve los suyos y los generales
-- de su profesional.
create policy resources_all_by_professional on public.resources
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy resources_select_by_patient on public.resources
  for select to authenticated
  using (
    patient_id = public.current_patient_id()
    or (patient_id is null and professional_id = public.current_patient_professional_id())
  );

-- documents: el profesional gestiona; el paciente lee los suyos.
create policy documents_all_by_professional on public.documents
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy documents_select_by_patient on public.documents
  for select to authenticated
  using (patient_id = public.current_patient_id());

-- consent_templates: el profesional gestiona; su paciente puede leer la que
-- debe firmar.
create policy consent_templates_all_by_professional on public.consent_templates
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy consent_templates_select_by_patient on public.consent_templates
  for select to authenticated
  using (professional_id = public.current_patient_professional_id());

-- consents (firmas): el paciente firma (insert) y lee lo suyo; el profesional
-- lo lee. Inmutable una vez creado (sin update/delete por authenticated).
create policy consents_insert_by_patient on public.consents
  for insert to authenticated
  with check (patient_id = public.current_patient_id());
create policy consents_select_by_patient on public.consents
  for select to authenticated
  using (patient_id = public.current_patient_id());
create policy consents_select_by_professional on public.consents
  for select to authenticated
  using (professional_id = public.current_professional_id());
