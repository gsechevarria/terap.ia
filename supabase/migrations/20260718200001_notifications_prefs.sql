-- =============================================================================
-- Sesión 8 · Suscripciones Web Push y preferencias de notificación
-- =============================================================================

-- Suscripciones Web Push (una por dispositivo/navegador del usuario).
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- Preferencias de notificación por usuario.
create table public.notification_preferences (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  appointment_reminders  boolean not null default true,
  new_appointment        boolean not null default true,
  new_task               boolean not null default true,
  new_scale              boolean not null default true,
  email_fallback         boolean not null default true,
  updated_at             timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS: cada usuario gestiona lo suyo. El envío programado usa service_role
-- (salta RLS) para leer todas las suscripciones/preferencias.
-- =============================================================================
alter table public.push_subscriptions      enable row level security;
alter table public.notification_preferences enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
