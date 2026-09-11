-- =============================================================================
-- Storage · el binario respeta shared_with_patient (ago 2026)
--
-- 20260725090001 cerró la FILA de `documents` (el paciente solo ve las que
-- tienen `shared_with_patient`), y su propio comentario avisaba de que eso
-- "protege la FILA, no el binario". La política de Storage nunca se revisó:
--
--   or public.current_patient_id() = ((storage.foldername(name))[1])::uuid
--
-- Como todo se guarda bajo `<patientId>/`, sin separar compartido de privado,
-- desde la sesión del paciente bastaba con:
--
--   const { data: objs } = await supabase.storage.from('files').list(miId)
--   // → devuelve TODO, incluidas las notas y los informes no compartidos
--
-- y pedir la URL firmada de cualquiera. Agravante: `shared_with_patient` no
-- aparecía ni una vez en `src/`, así que TODOS los documentos estaban en false
-- —privados por decisión del profesional— y todos eran descargables.
-- Añádase la Ley 41/2002 art. 18.3, que restringe el acceso del paciente a las
-- anotaciones subjetivas y a los datos de terceros.
--
-- NOTA sobre los casts: las políticas comparan el primer segmento de la ruta
-- COMO TEXTO, no casteando a uuid. PostgreSQL no garantiza el orden de
-- evaluación de los operandos de un AND, así que con `::uuid` bastaba un solo
-- objeto cuyo primer segmento no fuese un UUID para que la consulta entera
-- fallase con "invalid input syntax for type uuid".
-- =============================================================================

-- 1) Bucket `files` — lectura ------------------------------------------------
drop policy if exists "files_select_owner" on storage.objects;
drop policy if exists "files_select_professional" on storage.objects;
drop policy if exists "files_select_patient_shared" on storage.objects;

-- El profesional dueño del paciente ve todo lo de ese paciente.
create policy "files_select_professional"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.patients p
      where p.professional_id = (select public.current_professional_id())
    )
  );

-- El paciente solo ve: documentos marcados como compartidos, y los recursos
-- que su profesional le ha puesto en la biblioteca.
create policy "files_select_patient_shared"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and (
      exists (
        select 1 from public.documents d
         where d.storage_path = storage.objects.name
           and d.patient_id = (select public.current_patient_id())
           and d.shared_with_patient
      )
      or exists (
        select 1 from public.resources r
         where r.storage_path = storage.objects.name
           and r.patient_id = (select public.current_patient_id())
      )
    )
  );

-- 2) Bucket `files` — escritura, sin cast a uuid ------------------------------
drop policy if exists "files_insert_professional" on storage.objects;
create policy "files_insert_professional"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.patients p
      where p.professional_id = (select public.current_professional_id())
    )
  );

drop policy if exists "files_delete_professional" on storage.objects;
create policy "files_delete_professional"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.patients p
      where p.professional_id = (select public.current_professional_id())
    )
  );

-- 3) Bucket `receipts` — mismo tratamiento del cast ---------------------------
drop policy if exists "receipts_select_professional" on storage.objects;
create policy "receipts_select_professional"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]
        = (select public.current_professional_id())::text
  );

drop policy if exists "receipts_insert_professional" on storage.objects;
create policy "receipts_insert_professional"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]
        = (select public.current_professional_id())::text
  );

drop policy if exists "receipts_delete_professional" on storage.objects;
create policy "receipts_delete_professional"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]
        = (select public.current_professional_id())::text
  );

-- 4) Índices para las subconsultas por ruta -----------------------------------
create index if not exists documents_storage_path_idx
  on public.documents (storage_path);
create index if not exists resources_storage_path_idx
  on public.resources (storage_path);

-- 5) Límites de los buckets ---------------------------------------------------
-- Ninguno de los dos tenía `file_size_limit` ni `allowed_mime_types`: se podía
-- subir HTML o SVG activo, que servido desde una URL firmada del mismo origen
-- es un vector de XSS, además de no tener tope de tamaño.
update storage.buckets
   set file_size_limit = 20971520,   -- 20 MB
       allowed_mime_types = array[
         'application/pdf',
         'image/png', 'image/jpeg', 'image/webp',
         'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
         'video/mp4'
       ]
 where id = 'files';

update storage.buckets
   set file_size_limit = 20971520,   -- 20 MB
       allowed_mime_types = array[
         'application/pdf',
         'image/png', 'image/jpeg', 'image/webp'
       ]
 where id = 'receipts';
