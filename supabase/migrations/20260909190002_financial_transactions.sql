begin;
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

  if v_appt.attendance <> 'attended' or v_appt.status <> 'completed' then raise exception 'La cita no está completada'; end if;

  if exists (
    select 1 from public.payments where appointment_id = p_appointment_id
  ) then
    return;  -- ya liquidada
  end if;

  -- Bloquea el bono para que dos citas no consuman la misma sesión.
  select * into v_pack from public.session_packs
   where professional_id = v_appt.professional_id and patient_id = v_appt.patient_id
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
    raise exception 'Configura una tarifa antes de liquidar la cita';
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
create or replace function public.unsettle_appointment(p_appointment_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments%rowtype;
  v_pay  public.payments%rowtype;
begin
  select * into v_appt from public.appointments
   where id = p_appointment_id for update;
  if not found then return 'sin_pago'; end if;

  -- SECURITY DEFINER salta la RLS: la propiedad se comprueba a mano.
  if v_appt.professional_id is distinct from public.current_professional_id() then
    raise exception 'No autorizado';
  end if;

  select * into v_pay from public.payments
   where appointment_id = p_appointment_id for update;
  if not found then return 'sin_pago'; end if;

  -- Sesión de bono: se devuelve al bono y se borra la imputación.
  if v_pay.session_pack_id is not null then
    update public.session_packs
       set used_sessions = greatest(used_sessions - 1, 0)
     where id = v_pay.session_pack_id and professional_id = v_appt.professional_id and patient_id = v_appt.patient_id;
    if not found then raise exception 'Bono incoherente: requiere revisión'; end if;
    delete from public.payments where id = v_pay.id;
    return 'bono_devuelto';
  end if;

  -- Pago pendiente creado por la liquidación automática: se borra.
  if v_pay.status = 'pending' then
    delete from public.payments where id = v_pay.id;
    return 'borrado';
  end if;

  -- Cobro real ya registrado: NO se borra, pero se avisa para que el
  -- profesional decida (devolución, nota, o borrarlo a mano desde la ficha).
  return 'conservado_cobrado';
end;
$$;
revoke execute on function public.settle_attended_appointment(uuid), public.unsettle_appointment(uuid) from authenticated;

create function public.change_appointment(p_id uuid, p_attendance text default null, p_action text default 'attendance')
returns text language plpgsql security definer set search_path = '' as $$
declare a public.appointments%rowtype; result text := 'sin_pago';
begin
 select * into a from public.appointments where id = p_id for update;
 if not found or a.professional_id is distinct from public.current_professional_id() then raise exception 'Cita no disponible'; end if;
 if p_action not in ('attendance','cancel','delete') then raise exception 'Acción no válida'; end if;
 if p_action = 'attendance' and (p_attendance is null or p_attendance not in ('pending','attended','no_show','late_cancel')) then raise exception 'Asistencia no válida'; end if;
 if a.status = 'cancelled' and p_action = 'attendance' and p_attendance = 'attended' then raise exception 'La cita está cancelada'; end if;
 if p_action <> 'attendance' or p_attendance <> 'attended' then
   result := public.unsettle_appointment(p_id);
 end if;
 if p_action = 'delete' then
   if exists(select 1 from public.payments where appointment_id = p_id) then
     raise exception 'La cita tiene un cobro registrado: cancélala para conservar el historial';
   end if;
   delete from public.appointments where id = p_id;
 elsif p_action = 'cancel' then
   update public.appointments set status='cancelled', attendance='pending' where id=p_id;
 else
   update public.appointments set attendance=p_attendance::public.attendance_status,
     status=case when p_attendance='attended' then 'completed'::public.appointment_status
       when status='completed' then 'confirmed'::public.appointment_status else status end where id=p_id;
   if p_attendance='attended' then perform public.settle_attended_appointment(p_id); end if;
 end if;
 return result;
end; $$;
revoke all on function public.change_appointment(uuid,text,text) from public,anon;
grant execute on function public.change_appointment(uuid,text,text) to authenticated;

alter table public.session_packs add column request_id uuid;
create unique index session_packs_request_uq on public.session_packs(professional_id,request_id) where request_id is not null;
create function public.create_session_pack(p_patient_id uuid,p_total_sessions int,p_price_cents int,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pro uuid := public.current_professional_id(); pack uuid;
begin
 if pro is null or not public.professional_owns_patient(p_patient_id) then raise exception 'No autorizado'; end if;
 if p_total_sessions < 1 or p_total_sessions > 1000 or p_price_cents < 0 or p_request_id is null then raise exception 'Bono no válido'; end if;
 perform 1 from public.patients where id=p_patient_id for update;
 select id into pack from public.session_packs where professional_id=pro and request_id=p_request_id;
 if pack is not null then
   if not exists(select 1 from public.session_packs where id=pack and patient_id=p_patient_id and total_sessions=p_total_sessions and price_cents=p_price_cents) then raise exception 'La solicitud ya se utilizó con otros datos'; end if;
   return pack;
 end if;
 insert into public.session_packs(professional_id,patient_id,total_sessions,price_cents,request_id)
 values(pro,p_patient_id,p_total_sessions,p_price_cents,p_request_id) returning id into pack;
 insert into public.payments(professional_id,patient_id,session_pack_id,amount_cents,status,note)
 values(pro,p_patient_id,pack,p_price_cents,'pending','Compra de bono');
 return pack;
end; $$;
revoke all on function public.create_session_pack(uuid,int,int,uuid) from public,anon;
grant execute on function public.create_session_pack(uuid,int,int,uuid) to authenticated;

-- Borrar una imputación desde la tabla deja el bono inconsistente: solo la RPC.
create function public.guard_payment_delete() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user = 'authenticated' and (old.appointment_id is not null or old.session_pack_id is not null) then
   raise exception 'Corrige la cita o archiva el bono; conserva su registro económico';
 end if;
 return old;
end; $$;
create trigger payments_guard_delete before delete on public.payments for each row execute function public.guard_payment_delete();
create function public.preserve_payment_date() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and old.status='paid' and new.status='paid' then new.paid_at := old.paid_at;
 elsif new.status='paid' then new.paid_at := coalesce(new.paid_at,now());
 else new.paid_at := null; end if;
 if TG_OP='UPDATE' and old.appointment_id is not null and old.session_pack_id is not null
    and (new.status <> old.status or new.amount_cents <> old.amount_cents) then
   raise exception 'La imputación de bono no se modifica como un cobro';
 end if;
 return new;
end; $$;
create trigger payments_preserve_date before insert or update on public.payments for each row execute function public.preserve_payment_date();

create function public.save_expense(p_id uuid,p_data jsonb,p_replace_receipt boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare pro uuid := public.current_professional_id(); g public.gastos%rowtype; b public.bienes_inversion%rowtype;
 cfg public.configuracion_fiscal%rowtype; amort int; years int; recoverable numeric; value_cents int;
begin
 if pro is null then raise exception 'No autorizado'; end if;
 if p_id is not null then
   select * into g from public.gastos where id=p_id and professional_id=pro for update;
   if not found then raise exception 'Gasto no disponible'; end if;
   select * into b from public.bienes_inversion where gasto_id=p_id and professional_id=pro for update;
 else g.id := gen_random_uuid(); g.professional_id := pro; g.es_bien_inversion := false; end if;
 g.fecha := (p_data->>'fecha')::date;
 g.proveedor_nombre := p_data->>'proveedor_nombre'; g.proveedor_nif := p_data->>'proveedor_nif';
 g.concepto := p_data->>'concepto'; g.categoria_deducible := p_data->>'categoria_deducible';
 g.base_cents := (p_data->>'base_cents')::int; g.tipo_iva := (p_data->>'tipo_iva')::int;
 g.cuota_iva_cents := round(g.base_cents * g.tipo_iva / 100.0)::int;
 g.total_cents := g.base_cents + g.cuota_iva_cents;
 g.porcentaje_afectacion := (p_data->>'porcentaje_afectacion')::int;
 g.es_bien_inversion := coalesce((p_data->>'es_bien_inversion')::boolean,g.es_bien_inversion);
 if p_replace_receipt then g.adjunto_path := p_data->>'adjunto_path'; end if;
 if g.adjunto_path is not null and split_part(g.adjunto_path,'/',1) <> pro::text then raise exception 'Justificante no autorizado'; end if;
 amort := coalesce((p_data->>'porcentaje_amortizacion')::int,b.porcentaje_amortizacion,0);
 years := case when p_data ? 'anios_amortizacion' then (p_data->>'anios_amortizacion')::int else b.anios_amortizacion end;
 if g.es_bien_inversion and (amort < 1 or amort > 100 or years < 1 or years > 50) then raise exception 'Amortización no válida'; end if;
 insert into public.gastos(id,professional_id,fecha,proveedor_nombre,proveedor_nif,concepto,categoria_deducible,base_cents,tipo_iva,cuota_iva_cents,total_cents,porcentaje_afectacion,es_bien_inversion,adjunto_path)
 values(g.id,pro,g.fecha,g.proveedor_nombre,g.proveedor_nif,g.concepto,g.categoria_deducible,g.base_cents,g.tipo_iva,g.cuota_iva_cents,g.total_cents,g.porcentaje_afectacion,g.es_bien_inversion,g.adjunto_path)
 on conflict(id) do update set fecha=excluded.fecha,proveedor_nombre=excluded.proveedor_nombre,proveedor_nif=excluded.proveedor_nif,concepto=excluded.concepto,categoria_deducible=excluded.categoria_deducible,base_cents=excluded.base_cents,tipo_iva=excluded.tipo_iva,cuota_iva_cents=excluded.cuota_iva_cents,total_cents=excluded.total_cents,porcentaje_afectacion=excluded.porcentaje_afectacion,es_bien_inversion=excluded.es_bien_inversion,adjunto_path=excluded.adjunto_path;
 if g.es_bien_inversion then
   select * into cfg from public.configuracion_fiscal where professional_id=pro;
   recoverable := case coalesce(cfg.situacion_iva,'exenta') when 'exenta' then 0 when 'sujeta' then 100 else cfg.prorrata_iva_pct end;
   if recoverable is null then raise exception 'Configura la prorrata de IVA'; end if;
   value_cents := round((g.base_cents+g.cuota_iva_cents*(1-recoverable/100.0))*g.porcentaje_afectacion/100.0)::int;
   if b.id is null then
     insert into public.bienes_inversion(professional_id,gasto_id,descripcion,fecha_adquisicion,valor_adquisicion_cents,porcentaje_amortizacion,anios_amortizacion)
     values(pro,g.id,coalesce(g.concepto,g.proveedor_nombre,'Bien de inversión'),g.fecha,value_cents,amort,years);
   else
     update public.bienes_inversion set descripcion=coalesce(g.concepto,g.proveedor_nombre,'Bien de inversión'),fecha_adquisicion=g.fecha,valor_adquisicion_cents=value_cents,porcentaje_amortizacion=amort,anios_amortizacion=years where id=b.id;
   end if;
 elsif b.id is not null then delete from public.bienes_inversion where id=b.id; end if;
 return g.id;
end; $$;
revoke all on function public.save_expense(uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_expense(uuid,jsonb,boolean) to authenticated;

create function public.delete_expense(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare g public.gastos%rowtype;
begin
 select * into g from public.gastos where id=p_id and professional_id=public.current_professional_id() for update;
 if not found then raise exception 'Gasto no disponible'; end if;
 delete from public.bienes_inversion where gasto_id=p_id and professional_id=g.professional_id;
 delete from public.gastos where id=p_id;
 return g.adjunto_path;
end; $$;
revoke all on function public.delete_expense(uuid) from public,anon;
grant execute on function public.delete_expense(uuid) to authenticated;
commit;
