-- Solicitudes de cita del paciente ("pide y el profesional aprueba").
--
-- El paciente NO escribe en `appointments`: desde 20260725090001 no tiene
-- UPDATE directo y nunca tuvo INSERT. Aquí pide, y quien decide sigue siendo el
-- profesional. Por eso la solicitud es una tabla aparte y todo el camino pasa
-- por funciones `security definer`: sin políticas de insert/update por API, un
-- paciente no puede fabricar una solicitud ya aceptada ni resolverse la suya.
begin;

create type public.appointment_request_kind as enum ('new', 'reschedule', 'cancel');
create type public.appointment_request_status as enum (
  'pending', 'accepted', 'declined', 'withdrawn'
);

create table public.appointment_requests (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  -- Para 'reschedule' y 'cancel': la cita sobre la que se pide algo.
  appointment_id   uuid references public.appointments (id) on delete cascade,
  kind             public.appointment_request_kind not null,
  preferred_start  timestamptz,
  alt_start        timestamptz,
  duration_min     integer not null default 50,
  note             text,
  status           public.appointment_request_status not null default 'pending',
  resolution_note  text,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),

  -- Una propuesta de horario solo tiene sentido si se pide hora.
  constraint appointment_requests_start_required check (
    kind = 'cancel' or preferred_start is not null
  ),
  -- Cambiar o anular exige decir qué cita.
  constraint appointment_requests_appointment_required check (
    kind = 'new' or appointment_id is not null
  ),
  constraint appointment_requests_duration_sane check (
    duration_min between 15 and 240
  ),
  constraint appointment_requests_resolved_coherent check (
    (status = 'pending') = (resolved_at is null)
  )
);

create index appointment_requests_pro_pending_idx
  on public.appointment_requests (professional_id, created_at desc)
  where status = 'pending';
create index appointment_requests_patient_idx
  on public.appointment_requests (patient_id, created_at desc);

-- Una sola solicitud viva por cita: evita que dos "pedir cambio" seguidos dejen
-- al profesional con dos peticiones contradictorias sobre el mismo hueco.
create unique index appointment_requests_one_pending_per_appointment
  on public.appointment_requests (appointment_id)
  where status = 'pending' and appointment_id is not null;

alter table public.appointment_requests enable row level security;

-- Ambas partes LEEN; nadie escribe por API (solo las funciones de abajo).
create policy appointment_requests_select_by_professional
  on public.appointment_requests for select to authenticated
  using (professional_id = (select public.current_professional_id()));

create policy appointment_requests_select_by_patient
  on public.appointment_requests for select to authenticated
  using (patient_id = (select public.current_patient_id()));

grant select on public.appointment_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Paciente: pedir
-- ---------------------------------------------------------------------------
create function public.patient_request_appointment(
  p_kind            text,
  p_preferred_start timestamptz default null,
  p_alt_start       timestamptz default null,
  p_duration_min    integer default 50,
  p_note            text default null,
  p_appointment_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient    uuid := public.current_patient_id();
  v_pro        uuid;
  v_pro_user   uuid;
  v_kind       public.appointment_request_kind;
  v_pending    integer;
  v_id         uuid;
begin
  -- current_patient_id() ya exige consentimiento vigente.
  if v_patient is null then
    raise exception 'Acepta el consentimiento vigente para continuar';
  end if;

  if p_kind is null or p_kind not in ('new', 'reschedule', 'cancel') then
    raise exception 'Tipo de solicitud no válido';
  end if;
  v_kind := p_kind::public.appointment_request_kind;

  select professional_id into v_pro
  from public.patients where id = v_patient;
  select user_id into v_pro_user
  from public.professionals where id = v_pro;

  -- Antifloods: tres peticiones vivas por paciente es más que suficiente y evita
  -- que una app con un botón repetido llene la bandeja del profesional.
  select count(*) into v_pending
  from public.appointment_requests
  where patient_id = v_patient and status = 'pending';
  if v_pending >= 3 then
    raise exception 'Tienes 3 solicitudes pendientes. Espera a que tu profesional las revise.';
  end if;

  if v_kind = 'cancel' then
    p_preferred_start := null;
    p_alt_start := null;
  else
    if p_preferred_start is null then
      raise exception 'Indica una fecha y hora';
    end if;
    -- Margen de una hora: pedir hora para dentro de diez minutos no es una
    -- solicitud, es una llamada de teléfono.
    if p_preferred_start < now() + interval '1 hour' then
      raise exception 'Elige una hora con al menos una hora de antelación';
    end if;
    if p_preferred_start > now() + interval '1 year' then
      raise exception 'Elige una fecha dentro del próximo año';
    end if;
    if p_alt_start is not null and p_alt_start < now() + interval '1 hour' then
      raise exception 'La alternativa debe tener al menos una hora de antelación';
    end if;
  end if;

  if v_kind <> 'new' then
    -- La cita tiene que ser suya y estar aún por delante.
    perform 1 from public.appointments
    where id = p_appointment_id
      and patient_id = v_patient
      and status in ('scheduled', 'confirmed')
      and starts_at > now();
    if not found then
      raise exception 'Esa cita ya no admite cambios';
    end if;
  else
    p_appointment_id := null;
  end if;

  insert into public.appointment_requests (
    professional_id, patient_id, appointment_id, kind,
    preferred_start, alt_start, duration_min, note
  ) values (
    v_pro, v_patient, p_appointment_id, v_kind,
    p_preferred_start, p_alt_start, coalesce(p_duration_min, 50),
    nullif(btrim(p_note), '')
  )
  returning id into v_id;

  -- Aviso al profesional, en la misma transacción que la solicitud.
  if v_pro_user is not null then
    insert into public.notifications (
      user_id, professional_id, patient_id, channel, type,
      title, body, payload, status, dedupe_key
    ) values (
      v_pro_user, v_pro, v_patient, 'push', 'appointment_request',
      'terap.ia', 'Tienes una solicitud de cita pendiente.',
      jsonb_build_object('url', '/pro/solicitudes', 'request_id', v_id),
      'queued', 'apptreq:' || v_id
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return v_id;
end;
$$;

revoke all on function public.patient_request_appointment(text, timestamptz, timestamptz, integer, text, uuid) from public, anon;
grant execute on function public.patient_request_appointment(text, timestamptz, timestamptz, integer, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Paciente: retirar lo pedido
-- ---------------------------------------------------------------------------
create function public.patient_withdraw_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid := public.current_patient_id();
begin
  if v_patient is null then
    raise exception 'Acepta el consentimiento vigente para continuar';
  end if;

  update public.appointment_requests
     set status = 'withdrawn', resolved_at = now()
   where id = p_id and patient_id = v_patient and status = 'pending';

  if not found then
    raise exception 'Esa solicitud ya no está pendiente';
  end if;
end;
$$;

revoke all on function public.patient_withdraw_request(uuid) from public, anon;
grant execute on function public.patient_withdraw_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profesional: resolver
-- ---------------------------------------------------------------------------
-- Aceptar crea/mueve/cancela la cita Y marca la solicitud en la misma
-- transacción. Si la cita no se puede tocar, la solicitud sigue pendiente: no
-- queremos "aceptada" sin cita detrás.
create function public.resolve_appointment_request(
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
  where id = p_id and professional_id = v_pro and status = 'pending'
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
       where id = v_req.appointment_id and professional_id = v_pro;
      v_appt := v_req.appointment_id;
    else
      -- El profesional puede corregir el horario al aceptar; si no dice nada,
      -- vale el que pidió el paciente.
      v_start := coalesce(p_start, v_req.preferred_start);
      v_end   := coalesce(p_end, v_start + make_interval(mins => v_req.duration_min));

      if v_start is null or v_end <= v_start then
        raise exception 'El horario de la cita no es válido';
      end if;

      -- Solape con otra cita o con un bloqueo: se avisa, no se pisa.
      perform 1 from public.appointments a
       where a.professional_id = v_pro
         and a.status <> 'cancelled'
         and a.starts_at < v_end and a.ends_at > v_start
         and (v_req.appointment_id is null or a.id <> v_req.appointment_id);
      if found then
        raise exception 'Ese hueco se solapa con otra cita de tu agenda';
      end if;

      perform 1 from public.agenda_blocks b
       where b.professional_id = v_pro
         and b.starts_at < v_end and b.ends_at > v_start;
      if found then
        raise exception 'Ese hueco cae dentro de un bloqueo de tu agenda';
      end if;

      if v_req.kind = 'reschedule' then
        update public.appointments
           set starts_at = v_start, ends_at = v_end,
               status = 'scheduled', updated_at = now()
         where id = v_req.appointment_id and professional_id = v_pro;
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

  -- Aviso al paciente. En 'new'/'reschedule' aceptados, el trigger de
  -- `appointments` ya notifica el alta, así que aquí solo avisamos del resto
  -- para no mandar dos veces lo mismo.
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
