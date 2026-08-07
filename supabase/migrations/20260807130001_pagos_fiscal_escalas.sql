-- =============================================================================
-- Fase 3 · Dinero y datos clínicos (ago 2026)
--
-- Cuatro bloques: liquidación atómica de citas, vista fiscal con IVA y fecha en
-- hora española, endurecimiento de las escalas clínicas y alerta del ítem de
-- riesgo al profesional.
-- =============================================================================

-- =============================================================================
-- 1) LIQUIDACIÓN DE CITAS — atómica e idempotente
-- =============================================================================
-- La idempotencia era un SELECT seguido de un INSERT sin transacción, y el
-- consumo del bono un read-modify-write (`used_sessions + 1` leído en JS). Dos
-- clics en "acudió" creaban dos pagos para la misma cita y descontaban una sola
-- sesión del bono.

-- Deduplica pagos por cita antes de poder crear el índice (conserva el más
-- antiguo, que es el que la UI ya mostraba).
delete from public.payments a
 using public.payments b
 where a.appointment_id is not null
   and a.appointment_id = b.appointment_id
   and a.created_at > b.created_at;

create unique index if not exists payments_appointment_unique
  on public.payments (appointment_id) where appointment_id is not null;

create or replace function public.settle_attended_appointment(p_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_appt  public.appointments%rowtype;
  v_pack  public.session_packs%rowtype;
  v_price public.payment_settings%rowtype;
  v_amount int;
  v_currency text := 'EUR';
  v_note text := null;
begin
  -- `for update` serializa dos liquidaciones simultáneas de la misma cita.
  select * into v_appt from public.appointments
   where id = p_appointment_id for update;
  if not found then return; end if;

  -- SECURITY DEFINER salta la RLS: hay que comprobar la propiedad a mano.
  if v_appt.professional_id is distinct from public.current_professional_id() then
    raise exception 'No autorizado';
  end if;

  if exists (
    select 1 from public.payments where appointment_id = p_appointment_id
  ) then
    return;  -- ya liquidada
  end if;

  -- Bloquea el bono para que dos citas no consuman la misma sesión.
  select * into v_pack from public.session_packs
   where patient_id = v_appt.patient_id
     and active
     and used_sessions < total_sessions
   order by purchased_at
   limit 1
   for update;

  if found then
    update public.session_packs
       set used_sessions = used_sessions + 1
     where id = v_pack.id;

    -- Importe 0: el ingreso del bono ya se registró al venderlo (ver
    -- addPackAction). Esta fila es solo la imputación de la sesión.
    insert into public.payments (
      professional_id, patient_id, appointment_id, session_pack_id,
      amount_cents, currency, status, method, note, paid_at
    ) values (
      v_appt.professional_id, v_appt.patient_id, p_appointment_id, v_pack.id,
      0, coalesce(v_pack.currency, 'EUR'), 'paid', 'bono',
      'Sesión cubierta por bono', now()
    );
    return;
  end if;

  -- Sin bono: pago pendiente con la tarifa aplicable.
  select * into v_price from public.payment_settings
   where professional_id = v_appt.professional_id
     and patient_id = v_appt.patient_id
   limit 1;

  if not found then
    select * into v_price from public.payment_settings
     where professional_id = v_appt.professional_id
       and patient_id is null
     limit 1;
  end if;

  if found then
    v_amount := v_price.price_cents;
    v_currency := coalesce(v_price.currency, 'EUR');
  else
    -- "No hay tarifa" NO es lo mismo que "es gratis": se registra a 0 pero
    -- marcado, para que la UI lo muestre como pendiente de revisar en vez de
    -- enseñar una deuda de 0,00 € que parece correcta.
    v_amount := 0;
    v_note := 'Sin tarifa configurada — revisar importe';
  end if;

  insert into public.payments (
    professional_id, patient_id, appointment_id,
    amount_cents, currency, status, note
  ) values (
    v_appt.professional_id, v_appt.patient_id, p_appointment_id,
    v_amount, v_currency, 'pending', v_note
  );
end;
$$;

revoke all on function public.settle_attended_appointment(uuid) from public, anon;
grant execute on function public.settle_attended_appointment(uuid) to authenticated;

-- Operación inversa: marcar "acudió" por error y corregirlo dejaba el bono
-- consumido y el pago creado; el paciente perdía una sesión pagada. Y al borrar
-- la cita, `payments.appointment_id` pasaba a NULL y quedaba un pago huérfano
-- irreconciliable.
create or replace function public.unsettle_appointment(p_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments%rowtype;
  v_pay  public.payments%rowtype;
begin
  select * into v_appt from public.appointments
   where id = p_appointment_id for update;
  if not found then return; end if;

  if v_appt.professional_id is distinct from public.current_professional_id() then
    raise exception 'No autorizado';
  end if;

  select * into v_pay from public.payments
   where appointment_id = p_appointment_id for update;
  if not found then return; end if;

  -- Solo se revierte lo que generó la liquidación automática. Un pago que el
  -- profesional ya marcó como cobrado en efectivo NO se borra a la ligera.
  if v_pay.session_pack_id is not null then
    update public.session_packs
       set used_sessions = greatest(used_sessions - 1, 0)
     where id = v_pay.session_pack_id;
    delete from public.payments where id = v_pay.id;
  elsif v_pay.status = 'pending' then
    delete from public.payments where id = v_pay.id;
  end if;
  -- Un pago suelto ya cobrado se deja: borrarlo perdería un cobro real.
end;
$$;

revoke all on function public.unsettle_appointment(uuid) from public, anon;
grant execute on function public.unsettle_appointment(uuid) to authenticated;

-- =============================================================================
-- 2) VISTA FISCAL — IVA repercutido y fecha en hora española
-- =============================================================================
-- a) La vista solo contemplaba el caso exento, pero `configuracion_fiscal`
--    admite 'sujeta' y 'mixta' y la UI las ofrece: con 'sujeta', un cobro de
--    121 € se registraba como base 121 € / IVA 0 €. Con 300 sesiones al año son
--    ~6.300 € de rendimiento neto inflado (~1.260 € de más en pagos
--    fraccionados).
-- b) `fecha` era un timestamptz que PostgREST serializa en UTC, y el motor hace
--    slice(5,7) sobre él: un cobro del 1-abr a las 01:00 de Madrid se guardaba
--    como 2026-03-31T23:00Z y entraba en el 1T, que ya había vencido.

alter table public.configuracion_fiscal
  add column if not exists tipo_iva_repercutido int not null default 21
    check (tipo_iva_repercutido between 0 and 100);

-- Prorrata de IVA: % del IVA soportado que se recupera vía modelo 303.
-- NULL = sin determinar. En 'exenta' es 0 y en 'sujeta' es 100 por definición;
-- solo hace falta declararla en 'mixta'.
alter table public.configuracion_fiscal
  add column if not exists prorrata_iva_pct int
    check (prorrata_iva_pct between 0 and 100);

drop view if exists public.v_ingresos_fiscales;
create view public.v_ingresos_fiscales
  with (security_invoker = true) as
select
  p.id,
  p.professional_id,
  -- `date` ya en hora española: el motor puede seguir haciendo slice() sobre
  -- ella y los trimestres salen bien sin más cambios.
  (coalesce(p.paid_at, p.created_at) at time zone 'Europe/Madrid')::date as fecha,
  p.amount_cents as total_cents,
  case when coalesce(cf.situacion_iva, 'exenta') = 'exenta'
       then 'exenta' else 'sujeta' end as tipo_operacion,
  case when coalesce(cf.situacion_iva, 'exenta') = 'exenta'
       then p.amount_cents
       else round(
              p.amount_cents
              / (1 + coalesce(cf.tipo_iva_repercutido, 21) / 100.0)
            )::int
  end as base_cents,
  case when coalesce(cf.situacion_iva, 'exenta') = 'exenta'
       then 0
       else p.amount_cents - round(
              p.amount_cents
              / (1 + coalesce(cf.tipo_iva_repercutido, 21) / 100.0)
            )::int
  end as cuota_iva_cents,
  coalesce(cf.aplica_retencion_default, false) as retencion_aplicable,
  pt.full_name as nombre_pagador
from public.payments p
left join public.configuracion_fiscal cf on cf.professional_id = p.professional_id
left join public.patients pt on pt.id = p.patient_id
where p.status = 'paid';

-- =============================================================================
-- 3) ESCALAS CLÍNICAS — el trigger exige la respuesta completa
-- =============================================================================
-- El trigger sumaba CUALQUIER clave del JSONB, así que un POST directo a la
-- server action con {"1":0,"2":0,"3":0} sobre un PHQ-9 generaba score 0 y
-- severidad "Mínima": un registro clínico que afirma depresión mínima a partir
-- de 3 de 9 ítems, indistinguible de uno válido en la gráfica y en la analítica
-- agregada.
--
-- Y lo más grave: si faltaba el ítem 9, `flagged` salía false por el
-- `coalesce(..., 0)`. Un envío incompleto OCULTABA la ideación suicida. Ahora
-- una respuesta incompleta se rechaza, no se guarda con flagged = false.
create or replace function public.compute_scale_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_def       jsonb;
  v_item      jsonb;
  v_key       text;
  v_min       int;
  v_max       int;
  v_val       int;
  v_total     int := 0;
  v_expected  int;
  v_flag_item int;
  v_flag_thr  int;
  v_sev       text;
begin
  select definition into v_def from public.scales where id = new.scale_id;
  if v_def is null then
    raise exception 'Escala % no encontrada', new.scale_id;
  end if;

  v_expected := jsonb_array_length(v_def -> 'items');

  -- Rango válido a partir de las opciones declaradas en el catálogo.
  select min((o ->> 'value')::int), max((o ->> 'value')::int)
    into v_min, v_max
    from jsonb_array_elements(v_def -> 'options') as o;

  -- Suma SOLO los ítems de la definición y exige que estén TODOS presentes.
  for v_item in select * from jsonb_array_elements(v_def -> 'items') loop
    v_key := v_item ->> 'id';
    if not (new.answers ? v_key) then
      raise exception 'Respuesta incompleta: falta el ítem %', v_key
        using errcode = 'P0010';
    end if;
    v_val := (new.answers ->> v_key)::int;
    if v_val < v_min or v_val > v_max then
      raise exception 'Valor fuera de rango en el ítem %', v_key
        using errcode = 'P0011';
    end if;
    v_total := v_total + v_val;
  end loop;

  -- Claves de más (ítems inventados) también invalidan la respuesta: si no, un
  -- envío podría inflar la puntuación con claves que no son de la escala.
  if (select count(*) from jsonb_object_keys(new.answers)) <> v_expected then
    raise exception 'La respuesta contiene ítems que no pertenecen a la escala'
      using errcode = 'P0012';
  end if;

  new.score := v_total;

  -- Severidad por los tramos publicados (solo clasifica, no interpreta).
  select (s.value ->> 'label') into v_sev
    from jsonb_array_elements(v_def -> 'scoring' -> 'severity') as s
   where v_total between (s.value ->> 'min')::int and (s.value ->> 'max')::int
   limit 1;
  new.severity := v_sev;

  -- Ítem de riesgo. Arriba ya se ha exigido que TODOS los ítems estén, así que
  -- aquí no puede faltar; se comprueba igualmente porque el `coalesce(..., 0)`
  -- de la versión anterior es exactamente lo que ocultaba la ideación suicida.
  v_flag_item := (v_def ->> 'flag_item')::int;
  if v_flag_item is not null then
    if not (new.answers ? v_flag_item::text) then
      raise exception 'Falta el ítem de riesgo' using errcode = 'P0010';
    end if;
    v_flag_thr := coalesce((v_def ->> 'flag_threshold')::int, 1);
    new.flagged := (new.answers ->> v_flag_item::text)::int >= v_flag_thr;
  else
    new.flagged := false;
  end if;

  return new;
end;
$$;

-- Solo BEFORE INSERT: el UPDATE queda para el acuse de recibo, y recalcular
-- sobre él no tendría sentido (además, `scale_responses_guard` lo blinda).
drop trigger if exists scale_responses_compute on public.scale_responses;
create trigger scale_responses_compute
  before insert on public.scale_responses
  for each row execute function public.compute_scale_response();

-- No se puede retrodatar una respuesta: ventana de ±5 minutos.
drop policy if exists scale_responses_insert_by_patient on public.scale_responses;
create policy scale_responses_insert_by_patient on public.scale_responses
  for insert to authenticated
  with check (
    patient_id = (select public.current_patient_id())
    and submitted_at between now() - interval '5 minutes'
                         and now() + interval '5 minutes'
    and exists (
      select 1 from public.scale_assignments sa
       where sa.id = scale_responses.assignment_id
         and sa.patient_id = (select public.current_patient_id())
         and sa.active
    )
  );

-- =============================================================================
-- 4) ALERTA DEL ÍTEM DE RIESGO AL PROFESIONAL
-- =============================================================================
-- `flagged` se mostraba al paciente (con 024/112) y se contaba en el listado
-- del panel, pero no se encolaba ninguna notificación — y la RLS lo impedía
-- desde la sesión del paciente: `notifications_insert_by_professional` exige
-- `professional_id = current_professional_id()`, que para un paciente es NULL.
-- Resultado: un viernes a las 22:00, hasta 60 h sin escalado.
create or replace function public.notify_flagged_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_pro  uuid;
begin
  if new.flagged then
    select p.professional_id into v_pro
      from public.patients p where p.id = new.patient_id;
    select pr.user_id into v_user
      from public.professionals pr where pr.id = v_pro;

    if v_user is not null then
      insert into public.notifications
        (user_id, professional_id, patient_id, channel, type, title, body,
         payload, scheduled_for, status)
      values
        (v_user, v_pro, new.patient_id, 'push', 'scale_flag',
         'Respuesta con ítem de riesgo',
         'Un paciente ha marcado el ítem de riesgo de una escala.',
         jsonb_build_object('url', '/pro/patients/' || new.patient_id),
         null,          -- sin programar: sale en la siguiente pasada del cron
         'queued');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists scale_responses_notify_flag on public.scale_responses;
create trigger scale_responses_notify_flag
  after insert on public.scale_responses
  for each row execute function public.notify_flagged_response();

-- Acuse de recibo: sin él, `openAlerts` es un recuento histórico que nunca
-- vuelve a 0 y deja de servir como señal.
alter table public.scale_responses
  add column if not exists acknowledged_at timestamptz;
alter table public.scale_responses
  add column if not exists acknowledged_by uuid references public.professionals (id);

-- El profesional dueño puede marcar como visto (solo esas dos columnas: el
-- resto de la respuesta sigue siendo inmutable).
drop policy if exists scale_responses_ack_by_professional on public.scale_responses;
create policy scale_responses_ack_by_professional on public.scale_responses
  for update to authenticated
  using (
    patient_id in (
      select p.id from public.patients p
       where p.professional_id = (select public.current_professional_id())
    )
  )
  with check (
    patient_id in (
      select p.id from public.patients p
       where p.professional_id = (select public.current_professional_id())
    )
  );

-- Blinda el resto de columnas ante ese UPDATE.
create or replace function public.scale_responses_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.answers is distinct from old.answers
     or new.score is distinct from old.score
     or new.severity is distinct from old.severity
     or new.flagged is distinct from old.flagged
     or new.submitted_at is distinct from old.submitted_at
     or new.patient_id is distinct from old.patient_id
     or new.assignment_id is distinct from old.assignment_id then
    raise exception 'Las respuestas de escala son inmutables';
  end if;
  return new;
end;
$$;

drop trigger if exists scale_responses_immutable on public.scale_responses;
create trigger scale_responses_immutable
  before update on public.scale_responses
  for each row execute function public.scale_responses_guard();

create index if not exists scale_responses_unack_idx
  on public.scale_responses (patient_id)
  where flagged and acknowledged_at is null;
