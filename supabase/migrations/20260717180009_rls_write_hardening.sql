-- =============================================================================
-- Sesión 1 · Bloque 9: endurecimiento de RLS de escritura
--
-- Motivo: el test de RLS detectó que un profesional podía INSERT/UPDATE filas
-- con su propio professional_id pero apuntando al patient_id de OTRO profesional
-- (el with_check solo validaba professional_id). Se exige además que el paciente
-- sea suyo (professional_owns_patient). Para patient_id nullable se permite NULL.
--
-- Además: trigger que impide que un paciente cambie su vínculo (professional_id)
-- o su estado desde su propia sesión (solo el profesional dueño puede).
-- =============================================================================

alter policy tasks_all_by_professional on public.tasks
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

alter policy invitations_all_by_professional on public.invitations
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

alter policy scale_assignments_all_by_professional on public.scale_assignments
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

alter policy appointments_all_by_professional on public.appointments
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

alter policy session_packs_all_by_professional on public.session_packs
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

alter policy payments_all_by_professional on public.payments
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

alter policy documents_all_by_professional on public.documents
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

-- patient_id nullable (NULL = tarifa/recurso general del profesional).
alter policy payment_settings_all_by_professional on public.payment_settings
  with check (
    professional_id = public.current_professional_id()
    and (patient_id is null or public.professional_owns_patient(patient_id))
  );

alter policy resources_all_by_professional on public.resources
  with check (
    professional_id = public.current_professional_id()
    and (patient_id is null or public.professional_owns_patient(patient_id))
  );

-- Una notificación creada por un profesional debe dirigirse a un paciente suyo.
alter policy notifications_insert_by_professional on public.notifications
  with check (
    professional_id = public.current_professional_id()
    and public.professional_owns_patient(patient_id)
  );

-- Guard de integridad del vínculo del paciente: desde la sesión del propio
-- paciente (o cualquiera que no sea su profesional dueño) no se puede cambiar
-- professional_id ni status. La aceptación de invitación (SECURITY DEFINER) no
-- toca esos campos, así que no se ve afectada.
create or replace function public.patients_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.current_professional_id() is distinct from old.professional_id
     and (new.professional_id is distinct from old.professional_id
          or new.status is distinct from old.status) then
    raise exception 'No autorizado a modificar el vínculo o el estado del paciente';
  end if;
  return new;
end;
$$;

create trigger patients_guard_update
  before update on public.patients
  for each row execute function public.patients_guard();
