-- =============================================================================
-- Aviso al paciente cuando el profesional MUEVE, CANCELA o BORRA una cita.
--
-- Hasta ahora solo se avisaba al CREARLA (`appointments_notify`, en
-- 20260909190008). Si el profesional la cambiaba de hora o la anulaba, el
-- paciente no se enteraba salvo que abriera la app. Hallazgo H9 de
-- docs/SINCRONIZACION.md.
--
-- Reglas:
--   · Solo citas que aún no han empezado (antes o después del cambio).
--   · No avisa si quien cambia es el propio paciente (cancelar desde su app).
--   · No avisa si hay una solicitud del paciente pendiente sobre esa cita: es
--     `resolve_appointment_request` quien la está resolviendo, y ya avisa.
--   · Mismo canal y misma regla de privacidad que el resto: el texto es
--     genérico («Tienes una novedad…»), sin hora ni nombre en la pantalla de
--     bloqueo. Respeta la preferencia «citas» (`new_appointment`).
--   · Idempotente por `dedupe_key`: guardar dos veces lo mismo no duplica.
--
-- Como el resto de avisos, lo escribe la base: nadie puede fabricarlos por API.
-- =============================================================================

begin;

create or replace function public.queue_appointment_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id        uuid;
  v_patient   uuid;
  v_pro       uuid;
  v_ref       timestamptz;
  v_kind      text;
  v_recipient uuid;
begin
  if tg_op = 'DELETE' then
    if old.status = 'cancelled' or old.starts_at <= now() then
      return old;
    end if;
    v_kind := 'appointment_cancelled';
    v_id := old.id; v_patient := old.patient_id; v_pro := old.professional_id;
    v_ref := old.starts_at;
  else
    if greatest(old.starts_at, new.starts_at) <= now() then
      return new;
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      v_kind := 'appointment_cancelled';
    elsif new.starts_at is distinct from old.starts_at and new.status <> 'cancelled' then
      v_kind := 'appointment_moved';
    else
      return new;
    end if;
    v_id := new.id; v_patient := new.patient_id; v_pro := new.professional_id;
    v_ref := new.starts_at;
  end if;

  select user_id into v_recipient
    from public.patients where id = v_patient and status = 'active';

  if v_recipient is not null
     and v_recipient is distinct from auth.uid()
     and not exists (
       select 1 from public.appointment_requests r
        where r.appointment_id = v_id and r.status = 'pending')
  then
    insert into public.notifications (
      user_id, professional_id, patient_id, channel, type,
      title, body, payload, status, dedupe_key
    ) values (
      v_recipient, v_pro, v_patient, 'push', v_kind,
      'terap.ia', 'Tienes una novedad en tu cuenta.',
      jsonb_build_object('url', '/app/appointments', 'appointment_id', v_id, 'starts_at', v_ref),
      'queued', 'appt-change:' || v_id || ':' || v_kind || ':' || v_ref::text
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.queue_appointment_change() from public, anon, authenticated;

drop trigger if exists appointments_change_notify on public.appointments;
create trigger appointments_change_notify
  after update of starts_at, status or delete on public.appointments
  for each row execute function public.queue_appointment_change();

commit;
