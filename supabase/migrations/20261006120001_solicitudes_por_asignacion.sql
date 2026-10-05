-- =============================================================================
-- Solicitudes de cita: las resuelve cualquier profesional ASIGNADO al
-- expediente, no solo el de referencia.
--
-- Desde 20260916100003 el acceso clínico va por asignación, y la RLS de
-- `appointment_requests` ya deja LEER la solicitud a todo asignado
-- (`professional_owns_patient`). Pero `resolve_appointment_request` seguía
-- buscando `professional_id = current_professional_id()`, el profesional de
-- referencia: en un centro, el colaborador que lleva el caso no podía aceptar
-- ni rechazar ("Esa solicitud ya no está pendiente"). Hallazgo H3 de
-- docs/SINCRONIZACION.md.
--
-- Cambios, y ninguno más:
--
--   1. La solicitud se localiza por asignación (`professional_owns_patient`).
--   2. Cancelar o mover la cita del paciente exige también asignación, no ser
--      su autor. Y si la cita ya no existe o no se toca, se aborta con un
--      mensaje claro: antes la solicitud quedaba «aceptada» sin cita detrás.
--   3. Al MOVER una cita, los solapes y bloqueos se comprueban en la agenda de
--      quien tiene la cita, no en la de quien acepta. Una cita NUEVA va a la
--      agenda de quien acepta, como hasta ahora.
--
-- Misma firma y mismo tipo de retorno: basta `create or replace`.
-- =============================================================================

begin;

create or replace function public.resolve_appointment_request(
  p_id      uuid,
  p_action  text,
  p_start   timestamptz default null,
  p_end     timestamptz default null,
  p_note    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pro     uuid := public.current_professional_id();
  v_req     public.appointment_requests%rowtype;
  v_start   timestamptz;
  v_end     timestamptz;
  v_appt    uuid;
  v_agenda  uuid;
  v_user    uuid;
begin
  if v_pro is null then
    raise exception 'Solo el profesional resuelve solicitudes';
  end if;

  if p_action is null or p_action not in ('accept', 'decline') then
    raise exception 'Acción no válida';
  end if;

  -- Bloqueo de fila: dos pestañas abiertas no aceptan dos veces la misma.
  select * into v_req
  from public.appointment_requests
  where id = p_id and status = 'pending'
    and public.professional_owns_patient(patient_id)
  for update;

  if not found then
    raise exception 'Esa solicitud ya no está pendiente';
  end if;

  if p_action = 'decline' then
    update public.appointment_requests
       set status = 'declined', resolved_at = now(),
           resolution_note = nullif(btrim(p_note), '')
     where id = p_id;
  else
    if v_req.kind = 'cancel' then
      update public.appointments
         set status = 'cancelled', updated_at = now()
       where id = v_req.appointment_id and patient_id = v_req.patient_id;
      if not found then
        raise exception 'Esa cita ya no admite cambios';
      end if;
      v_appt := v_req.appointment_id;
    else
      -- El profesional puede corregir el horario al aceptar; si no dice nada,
      -- vale el que pidió el paciente.
      v_start := coalesce(p_start, v_req.preferred_start);
      v_end   := coalesce(p_end, v_start + make_interval(mins => v_req.duration_min));

      if v_start is null or v_end <= v_start then
        raise exception 'El horario de la cita no es válido';
      end if;

      -- En qué agenda cae: la de quien tiene la cita si se mueve; la de quien
      -- acepta si es nueva.
      if v_req.kind = 'reschedule' then
        select professional_id into v_agenda from public.appointments
         where id = v_req.appointment_id and patient_id = v_req.patient_id;
        if v_agenda is null then
          raise exception 'Esa cita ya no admite cambios';
        end if;
      else
        v_agenda := v_pro;
      end if;

      -- Solape con otra cita o con un bloqueo: se avisa, no se pisa.
      perform 1 from public.appointments a
       where a.professional_id = v_agenda
         and a.status <> 'cancelled'
         and a.starts_at < v_end and a.ends_at > v_start
         and (v_req.appointment_id is null or a.id <> v_req.appointment_id);
      if found then
        raise exception 'Ese hueco se solapa con otra cita de tu agenda';
      end if;

      perform 1 from public.agenda_blocks b
       where b.professional_id = v_agenda
         and b.starts_at < v_end and b.ends_at > v_start;
      if found then
        raise exception 'Ese hueco cae dentro de un bloqueo de tu agenda';
      end if;

      if v_req.kind = 'reschedule' then
        update public.appointments
           set starts_at = v_start, ends_at = v_end,
               status = 'scheduled', updated_at = now()
         where id = v_req.appointment_id and patient_id = v_req.patient_id;
        v_appt := v_req.appointment_id;
      else
        insert into public.appointments (
          professional_id, patient_id, starts_at, ends_at, status
        ) values (
          v_pro, v_req.patient_id, v_start, v_end, 'scheduled'
        )
        returning id into v_appt;
      end if;
    end if;

    update public.appointment_requests
       set status = 'accepted', resolved_at = now(),
           appointment_id = v_appt,
           resolution_note = nullif(btrim(p_note), '')
     where id = p_id;
  end if;

  -- Aviso al paciente. En 'new' aceptada, el trigger de `appointments` ya
  -- notifica el alta, así que aquí solo avisamos del resto.
  if not (p_action = 'accept' and v_req.kind = 'new') then
    select user_id into v_user from public.patients where id = v_req.patient_id;
    if v_user is not null then
      insert into public.notifications (
        user_id, professional_id, patient_id, channel, type,
        title, body, payload, status, dedupe_key
      ) values (
        v_user, v_pro, v_req.patient_id, 'push', 'appointment_request_resolved',
        'terap.ia', 'Tu profesional ha respondido a tu solicitud.',
        jsonb_build_object('url', '/app/appointments'),
        'queued', 'apptreqres:' || p_id
      )
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end if;

  return v_appt;
end;
$$;

revoke all on function public.resolve_appointment_request(uuid, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.resolve_appointment_request(uuid, text, timestamptz, timestamptz, text) to authenticated;

commit;
