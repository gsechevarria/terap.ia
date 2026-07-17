-- =============================================================================
-- Sesión 1 · Bloque 1: tipos (enums) y utilidades comunes
-- =============================================================================

-- Enums de dominio -----------------------------------------------------------
create type public.patient_status as enum ('active', 'archived');

create type public.assignment_type as enum ('one_off', 'recurring');

create type public.appointment_status as enum (
  'scheduled', 'confirmed', 'cancelled', 'completed'
);

create type public.attendance_status as enum (
  'pending', 'attended', 'no_show', 'late_cancel'
);

create type public.payment_status as enum ('pending', 'paid');

create type public.recurrence_freq as enum (
  'none', 'daily', 'weekly', 'biweekly', 'monthly'
);

create type public.resource_kind as enum ('pdf', 'audio', 'link');

create type public.notification_channel as enum ('push', 'email');

create type public.notification_status as enum (
  'queued', 'sent', 'failed', 'read'
);

-- Utilidad: mantener updated_at ----------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
