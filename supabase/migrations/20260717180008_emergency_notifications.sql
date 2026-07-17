-- =============================================================================
-- Sesión 1 · Bloque 8: enlaces de emergencia y notificaciones
-- =============================================================================

-- Enlaces de emergencia. professional_id NULL = global por defecto (024, 112),
-- visible para todos. Un profesional puede añadir/editar los suyos.
create table public.emergency_links (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid references public.professionals (id) on delete cascade,
  label            text not null,
  phone            text,
  url              text,
  description      text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index emergency_links_professional_id_idx on public.emergency_links (professional_id);

-- Globales por defecto (España).
insert into public.emergency_links (professional_id, label, phone, description, sort_order) values
(null, 'Línea de atención a la conducta suicida', '024', 'Atención 24 h, gratuita y confidencial.', 1),
(null, 'Emergencias', '112', 'Emergencias sanitarias, policía y bomberos.', 2);

-- Cola de notificaciones (push/recordatorios). El envío real lo hará una Edge
-- Function/cron en la Sesión 8; aquí solo se modela la cola.
create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  professional_id  uuid references public.professionals (id) on delete set null,
  patient_id       uuid references public.patients (id) on delete set null,
  channel          public.notification_channel not null default 'push',
  type             text,
  title            text,
  body             text,
  payload          jsonb,
  status           public.notification_status not null default 'queued',
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_status_idx on public.notifications (status);

create trigger emergency_links_set_updated_at
  before update on public.emergency_links
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.emergency_links enable row level security;
alter table public.notifications   enable row level security;

-- emergency_links: todos ven los globales + los de su profesional; el
-- profesional gestiona los suyos (no puede tocar los globales, professional_id
-- NULL, porque el with_check exige professional_id = current_professional_id()).
create policy emergency_links_select_visible on public.emergency_links
  for select to authenticated
  using (
    professional_id is null
    or professional_id = public.current_professional_id()
    or professional_id = public.current_patient_professional_id()
  );
create policy emergency_links_write_by_professional on public.emergency_links
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

-- notifications: el destinatario lee/actualiza/borra las suyas; puede crearlas
-- para sí mismo o el profesional para sus pacientes.
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());
create policy notifications_insert_self on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid());
create policy notifications_insert_by_professional on public.notifications
  for insert to authenticated
  with check (professional_id = public.current_professional_id());
