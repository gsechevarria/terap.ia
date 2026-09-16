-- =============================================================================
-- RLS: el acceso clínico deja de derivarse de "lo creé yo" y pasa a derivarse
-- de "estoy asignado a este expediente".
--
-- Dos cambios, aplicados tabla por tabla:
--
-- A) LADO PROFESIONAL. `professional_id = current_professional_id()` se
--    sustituye por `professional_owns_patient(patient_id)` en las tablas de
--    contenido clínico. Para una consulta individual el resultado es idéntico
--    —el titular sigue asignado a todos sus expedientes—; para un centro es la
--    diferencia entre ver un expediente y no verlo.
--
--    Lectura y escritura se separan a propósito:
--      · LEER  → cualquiera asignado al expediente. Es lo que hace útil que un
--                compañero te sustituya: ve la historia completa.
--      · CREAR → solo a tu nombre (`professional_id` = tú) y sobre expedientes
--                asignados.
--      · MODIFICAR / BORRAR → solo TUS PROPIAS filas. Un compañero no reescribe
--                ni borra la anotación de otro; añade la suya.
--
--    Las tablas que NO son clínicas sino del negocio de cada profesional
--    —gastos, bienes, configuración fiscal, expedientes fiscales, facturas,
--    retenciones, bloqueos de agenda, plantillas de consentimiento— se quedan
--    exactamente como estaban: `professional_id = current_professional_id()`.
--    Compartir centro no es compartir la contabilidad de nadie.
--
-- B) LADO PACIENTE. `patient_id = current_patient_id()` (escalar) pasa a
--    `patient_id in (select current_patient_ids())`. Desde la migración
--    anterior una persona puede tener expediente en varios centros, y con el
--    escalar solo habría visto uno de ellos —el más antiguo—, quedándose sin
--    acceso al resto sin ningún error.
-- =============================================================================

begin;

-- --- A) Tablas clínicas: acceso por asignación -------------------------------

-- tasks ----------------------------------------------------------------------
drop policy if exists tasks_all_by_professional on public.tasks;
create policy tasks_select_by_professional on public.tasks
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy tasks_insert_by_professional on public.tasks
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy tasks_update_by_professional on public.tasks
  for update to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id))
  with check (professional_id = (select public.current_professional_id())
              and public.professional_owns_patient(patient_id));
create policy tasks_delete_by_professional on public.tasks
  for delete to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id));

-- appointments ---------------------------------------------------------------
drop policy if exists appointments_all_by_professional on public.appointments;
create policy appointments_select_by_professional on public.appointments
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy appointments_insert_by_professional on public.appointments
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy appointments_update_by_professional on public.appointments
  for update to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id))
  with check (professional_id = (select public.current_professional_id())
              and public.professional_owns_patient(patient_id));
create policy appointments_delete_by_professional on public.appointments
  for delete to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id));

-- patient_notes --------------------------------------------------------------
-- Las notas privadas son del profesional que las escribe. Un compañero
-- asignado las LEE (es historia clínica del expediente) pero no las toca.
drop policy if exists patient_notes_all_by_professional on public.patient_notes;
create policy patient_notes_select_by_professional on public.patient_notes
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy patient_notes_insert_by_professional on public.patient_notes
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy patient_notes_update_by_professional on public.patient_notes
  for update to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));
create policy patient_notes_delete_by_professional on public.patient_notes
  for delete to authenticated
  using (professional_id = (select public.current_professional_id()));

-- scale_assignments ----------------------------------------------------------
drop policy if exists scale_assignments_all_by_professional on public.scale_assignments;
create policy scale_assignments_select_by_professional on public.scale_assignments
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy scale_assignments_insert_by_professional on public.scale_assignments
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy scale_assignments_update_by_professional on public.scale_assignments
  for update to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id))
  with check (professional_id = (select public.current_professional_id())
              and public.professional_owns_patient(patient_id));
create policy scale_assignments_delete_by_professional on public.scale_assignments
  for delete to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id));

-- documents ------------------------------------------------------------------
drop policy if exists documents_all_by_professional on public.documents;
create policy documents_select_by_professional on public.documents
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy documents_insert_by_professional on public.documents
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy documents_update_by_professional on public.documents
  for update to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id))
  with check (professional_id = (select public.current_professional_id())
              and public.professional_owns_patient(patient_id));
create policy documents_delete_by_professional on public.documents
  for delete to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id));

-- resources ------------------------------------------------------------------
-- `patient_id is null` son los recursos generales del profesional, que no
-- cuelgan de ningún expediente: siguen siendo suyos.
drop policy if exists resources_all_by_professional on public.resources;
create policy resources_select_by_professional on public.resources
  for select to authenticated using (
    professional_id = (select public.current_professional_id())
    or public.professional_owns_patient(patient_id));
create policy resources_write_by_professional on public.resources
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and (patient_id is null or public.professional_owns_patient(patient_id)));
create policy resources_update_by_professional on public.resources
  for update to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));
create policy resources_delete_by_professional on public.resources
  for delete to authenticated
  using (professional_id = (select public.current_professional_id()));

-- payments / session_packs / payment_settings --------------------------------
-- Son económicas pero por expediente: quien atiende necesita saber si hay bono.
drop policy if exists payments_all_by_professional on public.payments;
create policy payments_select_by_professional on public.payments
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy payments_insert_by_professional on public.payments
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy payments_update_by_professional on public.payments
  for update to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id))
  with check (professional_id = (select public.current_professional_id())
              and public.professional_owns_patient(patient_id));
create policy payments_delete_by_professional on public.payments
  for delete to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id));

drop policy if exists session_packs_all_by_professional on public.session_packs;
create policy session_packs_select_by_professional on public.session_packs
  for select to authenticated using (public.professional_owns_patient(patient_id));
create policy session_packs_insert_by_professional on public.session_packs
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
create policy session_packs_update_by_professional on public.session_packs
  for update to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id))
  with check (professional_id = (select public.current_professional_id())
              and public.professional_owns_patient(patient_id));
create policy session_packs_delete_by_professional on public.session_packs
  for delete to authenticated
  using (professional_id = (select public.current_professional_id())
         and public.professional_owns_patient(patient_id));

drop policy if exists payment_settings_all_by_professional on public.payment_settings;
create policy payment_settings_select_by_professional on public.payment_settings
  for select to authenticated using (
    professional_id = (select public.current_professional_id())
    or public.professional_owns_patient(patient_id));
create policy payment_settings_write_by_professional on public.payment_settings
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id()));
create policy payment_settings_update_by_professional on public.payment_settings
  for update to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));
create policy payment_settings_delete_by_professional on public.payment_settings
  for delete to authenticated
  using (professional_id = (select public.current_professional_id()));

-- consents -------------------------------------------------------------------
drop policy if exists consents_select_by_professional on public.consents;
create policy consents_select_by_professional on public.consents
  for select to authenticated using (public.professional_owns_patient(patient_id));

-- appointment_requests -------------------------------------------------------
drop policy if exists appointment_requests_select_by_professional on public.appointment_requests;
create policy appointment_requests_select_by_professional on public.appointment_requests
  for select to authenticated using (public.professional_owns_patient(patient_id));

-- mood_entries / scale_responses / task_completions --------------------------
-- Ya filtraban por expediente, pero resolviendo "mis pacientes" con
-- `patients.professional_id`. Pasan a la asignación.
drop policy if exists mood_entries_select_by_professional on public.mood_entries;
create policy mood_entries_select_by_professional on public.mood_entries
  for select to authenticated using (public.professional_owns_patient(patient_id));

drop policy if exists scale_responses_select_by_professional on public.scale_responses;
create policy scale_responses_select_by_professional on public.scale_responses
  for select to authenticated using (public.professional_owns_patient(patient_id));

drop policy if exists scale_responses_ack_by_professional on public.scale_responses;
create policy scale_responses_ack_by_professional on public.scale_responses
  for update to authenticated
  using (public.professional_owns_patient(patient_id))
  with check (public.professional_owns_patient(patient_id));

drop policy if exists task_completions_select_by_professional on public.task_completions;
create policy task_completions_select_by_professional on public.task_completions
  for select to authenticated using (public.professional_owns_patient(patient_id));

-- patients -------------------------------------------------------------------
-- El expediente lo ve quien está asignado. Administrar el centro NO basta:
-- es justo la separación que pide el encargo entre permiso administrativo y
-- acceso clínico. Quien gestiona el equipo reparte expedientes desde la ficha,
-- no navegando por todos ellos.
drop policy if exists patients_select_by_professional on public.patients;
create policy patients_select_by_professional on public.patients
  for select to authenticated
  using (
    id in (select public.current_clinical_patient_ids())
    -- Segunda vía, y no es redundante: al dar de alta un expediente, el
    -- `RETURNING` del INSERT evalúa esta política ANTES de que el disparador
    -- AFTER haya creado la asignación primaria —y `current_clinical_patient_ids()`
    -- es STABLE, así que ni siquiera la vería—. Sin esto, crear un paciente
    -- falla con "new row violates row-level security policy", que es justo lo
    -- que hace `createPatientAction` en cada alta.
    --
    -- No reabre el acceso por la puerta de atrás: exige membresía ACTIVA y
    -- acreditación, así que revocar la membresía sigue retirando el acceso
    -- aunque el profesional siga siendo el de referencia.
    or (professional_id = (select public.current_professional_id())
        and public.is_org_member(organization_id)
        and (select public.professional_is_operational())));

drop policy if exists patients_update_by_professional on public.patients;
create policy patients_update_by_professional on public.patients
  for update to authenticated
  using (public.professional_owns_patient(id))
  with check (public.professional_owns_patient(id));

-- El alta exige, además de ser el profesional de referencia, estar habilitado
-- y pertenecer a la organización a la que se adscribe el expediente.
drop policy if exists patients_insert_by_professional on public.patients;
create policy patients_insert_by_professional on public.patients
  for insert to authenticated
  with check (
    professional_id = (select public.current_professional_id())
    and user_id is null
    and (select public.professional_is_operational())
    and public.is_org_member(organization_id));

-- invitations ----------------------------------------------------------------
-- Invitar exige permiso explícito en la organización y acreditación resuelta.
drop policy if exists invitations_all_by_professional on public.invitations;
create policy invitations_select_by_professional on public.invitations
  for select to authenticated using (public.professional_owns_patient(patient_id));

-- pending_uploads ------------------------------------------------------------
drop policy if exists pending_uploads_owner on public.pending_uploads;
create policy pending_uploads_owner on public.pending_uploads
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id())
              and (patient_id is null or public.professional_owns_patient(patient_id)));

-- --- B) Lado paciente: varios expedientes ------------------------------------

drop policy if exists appointments_select_by_patient on public.appointments;
create policy appointments_select_by_patient on public.appointments
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists appointment_requests_select_by_patient on public.appointment_requests;
create policy appointment_requests_select_by_patient on public.appointment_requests
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists consents_select_by_patient on public.consents;
create policy consents_select_by_patient on public.consents
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists documents_select_by_patient on public.documents;
create policy documents_select_by_patient on public.documents
  for select to authenticated
  using (patient_id in (select public.current_patient_ids()) and shared_with_patient);

drop policy if exists payment_settings_select_by_patient on public.payment_settings;
create policy payment_settings_select_by_patient on public.payment_settings
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists payments_select_by_patient on public.payments;
create policy payments_select_by_patient on public.payments
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists session_packs_select_by_patient on public.session_packs;
create policy session_packs_select_by_patient on public.session_packs
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists scale_assignments_select_by_patient on public.scale_assignments;
create policy scale_assignments_select_by_patient on public.scale_assignments
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists scale_responses_select_by_patient on public.scale_responses;
create policy scale_responses_select_by_patient on public.scale_responses
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists task_completions_select_by_patient on public.task_completions;
create policy task_completions_select_by_patient on public.task_completions
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists tasks_select_by_patient on public.tasks;
create policy tasks_select_by_patient on public.tasks
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists mood_entries_select_by_patient on public.mood_entries;
create policy mood_entries_select_by_patient on public.mood_entries
  for select to authenticated using (patient_id in (select public.current_patient_ids()));

drop policy if exists mood_entries_update_today on public.mood_entries;
create policy mood_entries_update_today on public.mood_entries
  for update to authenticated
  using (patient_id in (select public.current_patient_ids())
         and entry_date = ((now() at time zone 'Europe/Madrid'))::date)
  with check (patient_id in (select public.current_patient_ids())
              and entry_date = ((now() at time zone 'Europe/Madrid'))::date);

drop policy if exists mood_entries_delete_today on public.mood_entries;
create policy mood_entries_delete_today on public.mood_entries
  for delete to authenticated
  using (patient_id in (select public.current_patient_ids())
         and entry_date = ((now() at time zone 'Europe/Madrid'))::date);

drop policy if exists resources_select_by_patient on public.resources;
create policy resources_select_by_patient on public.resources
  for select to authenticated
  using (patient_id in (select public.current_patient_ids())
         or (patient_id is null
             and professional_id in (select public.current_patient_professional_ids())));

drop policy if exists consent_templates_select_by_patient on public.consent_templates;
create policy consent_templates_select_by_patient on public.consent_templates
  for select to authenticated
  using (professional_id in (select public.current_patient_professional_ids()));

drop policy if exists professionals_select_by_patient on public.professionals;
create policy professionals_select_by_patient on public.professionals
  for select to authenticated
  using (id in (select public.current_patient_professional_ids()));

drop policy if exists emergency_links_select_visible on public.emergency_links;
create policy emergency_links_select_visible on public.emergency_links
  for select to authenticated
  using (professional_id is null
         or professional_id = (select public.current_professional_id())
         or professional_id in (select public.current_patient_professional_ids()));

commit;
