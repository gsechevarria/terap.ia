begin;
-- Los históricos se revisan, no se recalculan automáticamente con la situación actual.
alter table public.gastos add column iva_recuperable_pct int check(iva_recuperable_pct between 0 and 100);
alter table public.bienes_inversion add column fiscal_review_required boolean not null default true;
create or replace function public.save_expense(p_id uuid,p_data jsonb,p_replace_receipt boolean default false)
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
 select * into cfg from public.configuracion_fiscal where professional_id=pro;
 g.iva_recuperable_pct := coalesce((p_data->>'iva_recuperable_pct')::int,g.iva_recuperable_pct,
   case coalesce(cfg.situacion_iva,'exenta') when 'exenta' then 0 when 'sujeta' then 100 else cfg.prorrata_iva_pct end);
 if g.iva_recuperable_pct is null or g.iva_recuperable_pct not between 0 and 100 then raise exception 'Confirma el porcentaje de IVA recuperable'; end if;
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
 insert into public.gastos(id,professional_id,fecha,proveedor_nombre,proveedor_nif,concepto,categoria_deducible,base_cents,tipo_iva,cuota_iva_cents,total_cents,porcentaje_afectacion,es_bien_inversion,adjunto_path,iva_recuperable_pct)
 values(g.id,pro,g.fecha,g.proveedor_nombre,g.proveedor_nif,g.concepto,g.categoria_deducible,g.base_cents,g.tipo_iva,g.cuota_iva_cents,g.total_cents,g.porcentaje_afectacion,g.es_bien_inversion,g.adjunto_path,g.iva_recuperable_pct)
 on conflict(id) do update set fecha=excluded.fecha,proveedor_nombre=excluded.proveedor_nombre,proveedor_nif=excluded.proveedor_nif,concepto=excluded.concepto,categoria_deducible=excluded.categoria_deducible,base_cents=excluded.base_cents,tipo_iva=excluded.tipo_iva,cuota_iva_cents=excluded.cuota_iva_cents,total_cents=excluded.total_cents,porcentaje_afectacion=excluded.porcentaje_afectacion,es_bien_inversion=excluded.es_bien_inversion,adjunto_path=excluded.adjunto_path,iva_recuperable_pct=excluded.iva_recuperable_pct;
 if g.es_bien_inversion then
   select * into cfg from public.configuracion_fiscal where professional_id=pro;
   recoverable := g.iva_recuperable_pct;
   if recoverable is null then raise exception 'Configura la prorrata de IVA'; end if;
   value_cents := round((g.base_cents+g.cuota_iva_cents*(1-recoverable/100.0))*g.porcentaje_afectacion/100.0)::int;
   if b.id is null then
     insert into public.bienes_inversion(professional_id,gasto_id,descripcion,fecha_adquisicion,valor_adquisicion_cents,porcentaje_amortizacion,anios_amortizacion,fiscal_review_required)
     values(pro,g.id,coalesce(g.concepto,g.proveedor_nombre,'Bien de inversión'),g.fecha,value_cents,amort,years,false);
   else
     update public.bienes_inversion set descripcion=coalesce(g.concepto,g.proveedor_nombre,'Bien de inversión'),fecha_adquisicion=g.fecha,valor_adquisicion_cents=value_cents,porcentaje_amortizacion=amort,anios_amortizacion=years,fiscal_review_required=false where id=b.id;
   end if;
 elsif b.id is not null then delete from public.bienes_inversion where id=b.id; end if;
 return g.id;
end; $$;
commit;
