-- =============================================================================
-- Ficha de paciente · datos de contacto y personales
--   Añade teléfono, fecha de nacimiento, dirección, profesión y contacto de
--   emergencia a public.patients.
--
-- No requiere cambios de RLS: son columnas de la misma tabla, ya cubierta por
--   patients_select_by_professional / patients_update_by_professional (y el
--   paciente sobre su propia ficha por patients_update_self). El trigger
--   patients_guard sigue impidiendo reasignar professional_id/archivarse.
-- Idempotente (add column if not exists) para poder reejecutarse sin efecto.
-- =============================================================================
alter table public.patients
  add column if not exists phone             text,
  add column if not exists birth_date        date,
  add column if not exists address           text,
  add column if not exists profession        text,
  add column if not exists emergency_contact text;
