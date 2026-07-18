-- =============================================================================
-- Sesión 7 · Almacenamiento de archivos (documentos y recursos por paciente)
--   Bucket privado `files`. Convención de ruta: <patientId>/<archivo>.
--   RLS: el profesional dueño del paciente sube/lee/borra; el paciente lee.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

-- Lectura: profesional dueño del paciente o el propio paciente.
create policy "files_select_owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and (
      public.professional_owns_patient(((storage.foldername(name))[1])::uuid)
      or public.current_patient_id() = ((storage.foldername(name))[1])::uuid
    )
  );

-- Subida: solo el profesional dueño del paciente.
create policy "files_insert_professional"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and public.professional_owns_patient(((storage.foldername(name))[1])::uuid)
  );

-- Borrado: solo el profesional dueño del paciente.
create policy "files_delete_professional"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'files'
    and public.professional_owns_patient(((storage.foldername(name))[1])::uuid)
  );
