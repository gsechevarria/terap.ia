-- =============================================================================
-- REPARACIÓN DEL HISTORIAL DE MIGRACIONES
-- GENERADO automáticamente desde supabase/migrations/ — 41 migraciones.
--
-- ⚠️ NO EDITAR A MANO. La versión anterior llevaba la lista escrita a pulso y se
--    quedó en 26 de 41: su verificación afirmaba "debe salir 26" cuando el
--    repositorio ya tenía quince migraciones más, de modo que daba por bueno un
--    historial incompleto. Para regenerarlo:
--
--      node scripts/gen-reparar-historial.mjs
--
-- ⚠️ ESTO NO ES UNA MIGRACIÓN. No la copies a `supabase/migrations/` ni dejes
--    que la recoja un `db push`: solo escribe en la tabla de control del CLI.
--
-- Equivale a:  supabase migration repair --status applied <version> ...
--
-- PARA QUÉ SIRVE
-- El CLI lleva la cuenta de lo aplicado en
-- `supabase_migrations.schema_migrations`. Cuando una migración se aplica
-- pegándola en el editor SQL del panel, esa tabla no se entera: el fichero
-- queda como "pendiente" aunque su SQL ya esté en la base.
--
-- ⚠️ REGLA DE ORO: registra únicamente migraciones REALMENTE aplicadas.
--    Marcar como aplicada una que no lo esté es peor que no registrarla:
--    `db push` la saltará para siempre y el esquema quedará incompleto en
--    silencio. El PASO 1 lo comprueba por ti antes de escribir nada.
-- =============================================================================


-- =============================================================================
-- PASO 1 · ¿Están de verdad aplicadas? (solo lectura)
--
-- Comprueba EFECTOS en el esquema, no registros. Si algo sale 🔴, para: esa
-- migración hay que aplicarla de verdad, no marcarla. Son sondas de las
-- migraciones que más cambian el esquema, no de las 41.
-- =============================================================================

select 'invitations.token eliminada (20260725100001)' as efecto,
       case when not exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='invitations'
                and column_name='token')
            then 'aplicada' else '🔴 NO' end as estado
union all
select 'patients.phone (20260723110001)',
       case when exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='patients'
                and column_name='phone')
            then 'aplicada' else '🔴 NO' end
union all
select 'handle_new_user con app_metadata (20260807120001)',
       case when to_regprocedure('public.handle_new_user()') is not null
             and pg_get_functiondef('public.handle_new_user()'::regprocedure)
                 like '%raw_app_meta_data%'
            then 'aplicada' else '🔴 NO' end
union all
select 'unsettle_appointment devuelve text (20260809100001)',
       case when to_regprocedure('public.unsettle_appointment(uuid)') is not null
             and pg_get_function_result('public.unsettle_appointment(uuid)'::regprocedure) = 'text'
            then 'aplicada' else '🔴 NO' end
union all
select 'payments.fiscal_snapshot (20260909190006)',
       case when exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='payments'
                and column_name='fiscal_snapshot')
            then 'aplicada' else '🔴 NO' end
union all
select 'gastos.iva_recuperable_pct (20260909190009)',
       case when exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='gastos'
                and column_name='iva_recuperable_pct')
            then 'aplicada' else '🔴 NO' end
union all
select 'appointment_requests (20260911140001)',
       case when to_regclass('public.appointment_requests') is not null
            then 'aplicada' else '🔴 NO' end
union all
select 'expedientes_fiscales (20260915100001)',
       case when to_regclass('public.expedientes_fiscales') is not null
            then 'aplicada' else '🔴 NO' end;


-- =============================================================================
-- PASO 2 · REPARAR (ejecuta solo si el PASO 1 no tiene ningún 🔴)
--
-- Registra las 41 del repositorio. Idempotente: `where not exists`, así
-- que las que ya consten se quedan igual y ejecutarlo dos veces no duplica nada.
-- =============================================================================

insert into supabase_migrations.schema_migrations (version)
select t.v
  from (values
    ('20260717180001'),
    ('20260717180002'),
    ('20260717180003'),
    ('20260717180004'),
    ('20260717180005'),
    ('20260717180006'),
    ('20260717180007'),
    ('20260717180008'),
    ('20260717180009'),
    ('20260718090001'),
    ('20260718090002'),
    ('20260718140001'),
    ('20260718170001'),
    ('20260718200001'),
    ('20260718230001'),
    ('20260721090001'),
    ('20260723110001'),
    ('20260725090001'),
    ('20260725100001'),
    ('20260807120001'),
    ('20260807120002'),
    ('20260807120003'),
    ('20260807120004'),
    ('20260807130001'),
    ('20260807140001'),
    ('20260809100001'),
    ('20260909190001'),
    ('20260909190002'),
    ('20260909190003'),
    ('20260909190004'),
    ('20260909190005'),
    ('20260909190006'),
    ('20260909190007'),
    ('20260909190008'),
    ('20260909190009'),
    ('20260909190010'),
    ('20260909190011'),
    ('20260911090001'),
    ('20260911090002'),
    ('20260911140001'),
    ('20260915100001')
  ) as t(v)
 where not exists (
   select 1 from supabase_migrations.schema_migrations m where m.version = t.v
 );


-- =============================================================================
-- PASO 3 · Rellenar el nombre (cosmético)
--
-- Algunas versiones del CLI guardan también el nombre. Si tu tabla no tiene esa
-- columna, este bloque no hace nada en vez de fallar. Solo afecta a lo legible
-- que salga `supabase migration list`.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='supabase_migrations'
       and table_name='schema_migrations'
       and column_name='name'
  ) then
    update supabase_migrations.schema_migrations m
       set name = d.name
      from (values
    ('20260717180001','types_and_utils'),
    ('20260717180002','identity'),
    ('20260717180003','tasks'),
    ('20260717180004','scales'),
    ('20260717180005','appointments'),
    ('20260717180006','payments'),
    ('20260717180007','wellbeing'),
    ('20260717180008','emergency_notifications'),
    ('20260717180009','rls_write_hardening'),
    ('20260718090001','patient_notes'),
    ('20260718090002','invitation_preview'),
    ('20260718140001','agenda_blocks'),
    ('20260718170001','storage_files'),
    ('20260718200001','notifications_prefs'),
    ('20260718230001','device_push_tokens'),
    ('20260721090001','contabilidad'),
    ('20260723110001','patient_contact_fields'),
    ('20260725090001','rls_patient_hardening'),
    ('20260725100001','invitation_token_hash'),
    ('20260807120001','role_in_app_metadata'),
    ('20260807120002','invitation_hardening'),
    ('20260807120003','storage_hardening'),
    ('20260807120004','data_integrity'),
    ('20260807130001','pagos_fiscal_escalas'),
    ('20260807140001','rendimiento'),
    ('20260809100001','unsettle_informativo'),
    ('20260909190001','security_invariants'),
    ('20260909190002','financial_transactions'),
    ('20260909190003','consent_versions'),
    ('20260909190004','delivery_and_storage'),
    ('20260909190005','pending_uploads'),
    ('20260909190006','fiscal_snapshots'),
    ('20260909190007','direct_write_guards'),
    ('20260909190008','transactional_notifications'),
    ('20260909190009','expense_fiscal_history'),
    ('20260909190010','task_completion'),
    ('20260909190011','consent_integrity'),
    ('20260911090001','explicit_api_grants'),
    ('20260911090002','admin_professional_provisioning'),
    ('20260911140001','appointment_requests'),
    ('20260915100001','expediente_fiscal')
      ) as d(version, name)
     where m.version = d.version
       and m.name is distinct from d.name;
  end if;
end $$;


-- =============================================================================
-- PASO 4 · VERIFICACIÓN — deben salir 41 y ningún '🔴 FALTA'
-- =============================================================================

with en_disco (version, name) as (values
    ('20260717180001','types_and_utils'),
    ('20260717180002','identity'),
    ('20260717180003','tasks'),
    ('20260717180004','scales'),
    ('20260717180005','appointments'),
    ('20260717180006','payments'),
    ('20260717180007','wellbeing'),
    ('20260717180008','emergency_notifications'),
    ('20260717180009','rls_write_hardening'),
    ('20260718090001','patient_notes'),
    ('20260718090002','invitation_preview'),
    ('20260718140001','agenda_blocks'),
    ('20260718170001','storage_files'),
    ('20260718200001','notifications_prefs'),
    ('20260718230001','device_push_tokens'),
    ('20260721090001','contabilidad'),
    ('20260723110001','patient_contact_fields'),
    ('20260725090001','rls_patient_hardening'),
    ('20260725100001','invitation_token_hash'),
    ('20260807120001','role_in_app_metadata'),
    ('20260807120002','invitation_hardening'),
    ('20260807120003','storage_hardening'),
    ('20260807120004','data_integrity'),
    ('20260807130001','pagos_fiscal_escalas'),
    ('20260807140001','rendimiento'),
    ('20260809100001','unsettle_informativo'),
    ('20260909190001','security_invariants'),
    ('20260909190002','financial_transactions'),
    ('20260909190003','consent_versions'),
    ('20260909190004','delivery_and_storage'),
    ('20260909190005','pending_uploads'),
    ('20260909190006','fiscal_snapshots'),
    ('20260909190007','direct_write_guards'),
    ('20260909190008','transactional_notifications'),
    ('20260909190009','expense_fiscal_history'),
    ('20260909190010','task_completion'),
    ('20260909190011','consent_integrity'),
    ('20260911090001','explicit_api_grants'),
    ('20260911090002','admin_professional_provisioning'),
    ('20260911140001','appointment_requests'),
    ('20260915100001','expediente_fiscal')
)
select d.version as "Versión",
       d.name    as "Migración",
       case when m.version is null then '🔴 FALTA' else 'registrada' end as "Estado"
  from en_disco d
  left join supabase_migrations.schema_migrations m on m.version = d.version
 order by d.version;

-- Comparación de recuentos. "en_disco" debe ser 41 y coincidir con el
-- historial; si el historial tiene MÁS, hay registros sin fichero en el repo.
select
  (select count(*) from (values
    ('20260717180001'),
    ('20260717180002'),
    ('20260717180003'),
    ('20260717180004'),
    ('20260717180005'),
    ('20260717180006'),
    ('20260717180007'),
    ('20260717180008'),
    ('20260717180009'),
    ('20260718090001'),
    ('20260718090002'),
    ('20260718140001'),
    ('20260718170001'),
    ('20260718200001'),
    ('20260718230001'),
    ('20260721090001'),
    ('20260723110001'),
    ('20260725090001'),
    ('20260725100001'),
    ('20260807120001'),
    ('20260807120002'),
    ('20260807120003'),
    ('20260807120004'),
    ('20260807130001'),
    ('20260807140001'),
    ('20260809100001'),
    ('20260909190001'),
    ('20260909190002'),
    ('20260909190003'),
    ('20260909190004'),
    ('20260909190005'),
    ('20260909190006'),
    ('20260909190007'),
    ('20260909190008'),
    ('20260909190009'),
    ('20260909190010'),
    ('20260909190011'),
    ('20260911090001'),
    ('20260911090002'),
    ('20260911140001'),
    ('20260915100001')
  ) as t(v))                                                as "En el repositorio",
  (select count(*) from supabase_migrations.schema_migrations) as "En el historial";
