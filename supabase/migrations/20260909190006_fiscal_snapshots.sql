begin;
-- No se reconstruye el pasado usando la configuración de hoy.
alter table public.payments add column fiscal_snapshot jsonb;
create function public.capture_payment_fiscal() returns trigger language plpgsql set search_path='' as $$
declare cfg public.configuracion_fiscal%rowtype; rate int; base int;
begin
 if TG_OP='UPDATE' and new.amount_cents=old.amount_cents then return new; end if;
 -- Un importe modificado invalida el cálculo previo, no conserva una base incoherente.
 new.fiscal_snapshot := null;
 select * into cfg from public.configuracion_fiscal where professional_id=new.professional_id;
 -- Retenciones y actividad mixta requieren confirmación por operación.
 if not found or cfg.situacion_iva='mixta' or cfg.aplica_retencion_default then return new; end if;
 rate := case when cfg.situacion_iva='exenta' then 0 else cfg.tipo_iva_repercutido end;
 base := round(new.amount_cents/(1+rate/100.0))::int;
 new.fiscal_snapshot := jsonb_build_object('tipo_operacion',cfg.situacion_iva,'tipo_iva',rate,
   'base_cents',base,'cuota_iva_cents',new.amount_cents-base,'retencion_cents',0,'source','configuracion', 'recorded_at',now());
 return new;
end; $$;
create trigger payments_capture_fiscal before insert or update of amount_cents on public.payments
 for each row execute function public.capture_payment_fiscal();
create function public.set_payment_fiscal(p_id uuid,p_tipo text,p_iva int,p_retencion_cents int) returns void
language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype; base int;
begin
 select * into p from public.payments where id=p_id and professional_id=public.current_professional_id() for update;
 if not found then raise exception 'Pago no disponible'; end if;
 if p_tipo is null or p_iva is null or p_retencion_cents is null or p_tipo not in ('exenta','sujeta') or p_iva<0 or p_iva>100 or p_retencion_cents<0 then raise exception 'Datos fiscales no válidos'; end if;
 if p_tipo='exenta' then p_iva:=0; end if;
 base:=round(p.amount_cents/(1+p_iva/100.0))::int;
 if p_retencion_cents>base then raise exception 'La retención supera la base'; end if;
 update public.payments set fiscal_snapshot=jsonb_build_object('tipo_operacion',p_tipo,'tipo_iva',p_iva,
   'base_cents',base,'cuota_iva_cents',p.amount_cents-base,'retencion_cents',p_retencion_cents,
   'source','confirmacion_profesional','recorded_at',now()) where id=p_id;
end; $$;
revoke all on function public.set_payment_fiscal(uuid,text,int,int) from public,anon;
grant execute on function public.set_payment_fiscal(uuid,text,int,int) to authenticated;
drop view public.v_ingresos_fiscales;
create view public.v_ingresos_fiscales with(security_invoker=true) as
 select p.id,p.professional_id,(coalesce(p.paid_at,p.created_at) at time zone 'Europe/Madrid')::date fecha,
 p.amount_cents total_cents,p.fiscal_snapshot->>'tipo_operacion' tipo_operacion,
 (p.fiscal_snapshot->>'base_cents')::int base_cents,(p.fiscal_snapshot->>'cuota_iva_cents')::int cuota_iva_cents,
 coalesce((p.fiscal_snapshot->>'retencion_cents')::int,0)>0 retencion_aplicable,
 (p.fiscal_snapshot->>'retencion_cents')::int retencion_cents,pt.full_name nombre_pagador,
 p.fiscal_snapshot is null fiscal_review_required
 from public.payments p left join public.patients pt on pt.id=p.patient_id where p.status='paid' and p.amount_cents>0;
commit;
