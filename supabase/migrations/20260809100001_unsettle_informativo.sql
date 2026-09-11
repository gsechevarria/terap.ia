-- =============================================================================
-- `unsettle_appointment` deja de ser muda (ago 2026)
--
-- PROBLEMA detectado probando a mano: al corregir un "acudió" a "no acudió", el
-- pago a veces no desaparecía y la aplicación no daba ninguna explicación.
--
-- La causa es una decisión deliberada mal comunicada: la función se niega a
-- borrar un pago que YA está marcado como cobrado y no procede de un bono,
-- porque borrarlo destruiría el registro de un cobro real. Eso está bien; lo que
-- estaba mal es que lo hacía en SILENCIO, así que desde fuera era
-- indistinguible de un fallo.
--
-- Ahora devuelve QUÉ ha hecho y la interfaz lo enseña.
--
-- Valores devueltos:
--   'sin_pago'            no había pago asociado a esa cita
--   'bono_devuelto'       se borró el pago y se devolvió la sesión al bono
--   'borrado'             se borró el pago pendiente
--   'conservado_cobrado'  NO se tocó: es un cobro real ya registrado
-- =============================================================================

drop function if exists public.unsettle_appointment(uuid);

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
     where id = v_pay.session_pack_id;
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

revoke all on function public.unsettle_appointment(uuid) from public, anon;
grant execute on function public.unsettle_appointment(uuid) to authenticated;
