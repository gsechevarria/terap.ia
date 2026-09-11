-- Diagnóstico de SOLO LECTURA. Ejecutar en una copia aislada después de las
-- migraciones 20260909190001..011 y antes de validar restricciones históricas.
-- Devuelve identificadores técnicos; no incluye nombres, correos ni notas.
begin transaction read only;
select version from supabase_migrations.schema_migrations order by version desc limit 20;
select conrelid::regclass tabla,conname restriccion from pg_constraint
 where connamespace='public'::regnamespace and not convalidated order by 1,2;
select p.id from public.payments p where
 not exists(select 1 from public.patients x where x.id=p.patient_id and x.professional_id=p.professional_id)
 or (p.appointment_id is not null and not exists(select 1 from public.appointments x where x.id=p.appointment_id and x.professional_id=p.professional_id and x.patient_id=p.patient_id))
 or (p.session_pack_id is not null and not exists(select 1 from public.session_packs x where x.id=p.session_pack_id and x.professional_id=p.professional_id and x.patient_id=p.patient_id));
select b.id,b.used_sessions,count(p.id) imputaciones from public.session_packs b
 left join public.payments p on p.session_pack_id=b.id and p.appointment_id is not null
 group by b.id having b.used_sessions<>count(p.id);
select b.id from public.session_packs b where b.price_cents>0 and not exists(
 select 1 from public.payments p where p.session_pack_id=b.id and p.appointment_id is null and p.amount_cents=b.price_cents);
select id from public.payments where status='paid' and amount_cents>0 and fiscal_snapshot is null;
select id from public.gastos where iva_recuperable_pct is null;
select id,gasto_id from public.bienes_inversion where fiscal_review_required;
select id from public.documents where storage_path is not null and split_part(storage_path,'/',1)<>patient_id::text;
select id from public.resources where storage_path is not null and (patient_id is null or split_part(storage_path,'/',1)<>patient_id::text);
select task_id,patient_id,count(*) from public.task_completions group by task_id,patient_id having count(*)>1;
select c.id from public.consents c left join public.consent_templates t on t.id=c.template_id
 where t.id is null or c.professional_id<>t.professional_id or c.template_version<>t.version
 or c.content_body is distinct from t.body
 or c.content_hash is distinct from encode(extensions.digest(t.body,'sha256'),'hex');
select p.id from public.professionals p join auth.users u on u.id=p.user_id
 where u.raw_app_meta_data->>'role' is distinct from 'professional';
-- El origen legítimo de cada alta profesional previa requiere revisión administrativa:
-- el esquema anterior podía promocionar al registrarse; no se deduce legitimidad del rol actual.
select id from public.push_subscriptions where not public.valid_push_endpoint(endpoint);
select status,count(*) from public.notifications group by status;
select bucket,count(*) from public.storage_cleanup_jobs group by bucket;
commit;
