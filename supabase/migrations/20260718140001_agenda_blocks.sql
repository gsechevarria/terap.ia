-- =============================================================================
-- Sesión 5 · Bloqueos de agenda (vacaciones / no disponible)
--   Franjas del profesional sin paciente. Privadas del profesional.
-- =============================================================================

create table public.agenda_blocks (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  reason           text,
  created_at       timestamptz not null default now(),
  constraint block_time_valid check (ends_at > starts_at)
);
create index agenda_blocks_professional_id_idx on public.agenda_blocks (professional_id);
create index agenda_blocks_starts_at_idx on public.agenda_blocks (starts_at);

alter table public.agenda_blocks enable row level security;

create policy agenda_blocks_all_by_professional on public.agenda_blocks
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
