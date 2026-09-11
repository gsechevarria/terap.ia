begin;
create or replace function public.current_professional_id()
returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.professionals p join auth.users u on u.id=p.user_id
 where p.user_id=auth.uid() and p.deleted_at is null and u.raw_app_meta_data->>'role'='professional'
$$;
create or replace function public.current_patient_professional_id()
returns uuid language sql stable security definer set search_path='' as $$
 select professional_id from public.patients where id=public.current_patient_id()
$$;
create function public.guard_professional_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and
   (new.user_id is distinct from old.user_id or new.deleted_at is distinct from old.deleted_at) then
   raise exception 'La identidad profesional solo la administra el servidor';
 end if;
 return new;
end; $$;
create trigger professionals_identity before update on public.professionals for each row execute function public.guard_professional_identity();

-- Invoker deliberado: una RPC SECURITY DEFINER autorizada realiza la operación completa.
create function public.guard_transactional_write() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' then raise exception 'Utiliza la operación transaccional correspondiente'; end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger gastos_transactional before insert or update or delete on public.gastos for each row execute function public.guard_transactional_write();
create trigger bienes_transactional before insert or update or delete on public.bienes_inversion for each row execute function public.guard_transactional_write();
create trigger packs_transactional before insert or delete on public.session_packs for each row execute function public.guard_transactional_write();
create function public.guard_pack_update() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and (to_jsonb(new)-'active'-'updated_at') is distinct from (to_jsonb(old)-'active'-'updated_at') then
   raise exception 'El saldo y el precio del bono se modifican mediante operaciones transaccionales';
 end if;
 return new;
end; $$;
create trigger packs_update_guard before update on public.session_packs for each row execute function public.guard_pack_update();
create function public.guard_appointment_write() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user<>'authenticated' then
   if TG_OP='DELETE' then return old; end if;
   return new;
 end if;
 if TG_OP='DELETE' then raise exception 'Elimina la cita mediante su operación transaccional'; end if;
 if TG_OP='INSERT' then
   if new.attendance<>'pending' or new.status not in ('scheduled','confirmed') then raise exception 'Asistencia inicial no válida'; end if;
 elsif new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.attendance is distinct from old.attendance or new.status is distinct from old.status
    or new.patient_id is distinct from old.patient_id or new.professional_id is distinct from old.professional_id then
   raise exception 'La asistencia y la cancelación requieren liquidación transaccional';
 end if;
 return new;
end; $$;
create trigger appointments_transactional before insert or update or delete on public.appointments for each row execute function public.guard_appointment_write();
create function public.guard_payment_write() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user<>'authenticated' then return new; end if;
 if TG_OP='INSERT' then
   if new.appointment_id is not null or new.session_pack_id is not null then raise exception 'Registra la cita o el bono mediante su operación transaccional'; end if;
 elsif new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.professional_id is distinct from old.professional_id or new.patient_id is distinct from old.patient_id
    or new.appointment_id is distinct from old.appointment_id or new.session_pack_id is distinct from old.session_pack_id
    or new.currency is distinct from old.currency then
   raise exception 'No se puede reasignar un registro económico';
 end if;
 if TG_OP='UPDATE' and old.session_pack_id is not null and new.amount_cents is distinct from old.amount_cents then raise exception 'El importe del bono se conserva con su registro económico'; end if;
 if TG_OP='UPDATE' and new.amount_cents=old.amount_cents and new.fiscal_snapshot is distinct from old.fiscal_snapshot then
   raise exception 'Confirma los datos fiscales mediante la operación fiscal';
 end if;
 return new;
end; $$;
create trigger payments_write_guard before insert or update on public.payments for each row execute function public.guard_payment_write();
alter table public.payments drop constraint if exists payments_patient_id_fkey;
commit;
