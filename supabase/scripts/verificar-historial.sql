-- =============================================================================
-- Inventario del historial de migraciones + comprobación de regresiones
-- SOLO LECTURA. Pegar entero en el editor SQL de Supabase.
--
-- Contexto: la primera verificación devolvió 18 migraciones registradas de las
-- 26 que hay en el repositorio, con la última en 20260725100001. El esquema, en
-- cambio, tiene aplicadas todas las de agosto. Este script dice exactamente
-- qué consta y qué no, y vuelve a comprobar lo que un `db push` que replique
-- migraciones antiguas podría haber revertido.
-- =============================================================================

-- ── BLOQUE 1 · Qué versiones constan y cuáles faltan ────────────────────────
with ficheros (version, descripcion) as (values
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
  ('20260809100001','unsettle_informativo')
)
select
  f.version                          as "Versión",
  f.descripcion                      as "Migración",
  case when m.version is null
       then '🔴 NO registrada'
       else 'registrada' end         as "Historial CLI"
from ficheros f
left join supabase_migrations.schema_migrations m on m.version = f.version
order by f.version;


-- ── BLOQUE 2 · Registros en el historial que NO tienen fichero ──────────────
-- Si sale alguna fila, hay algo aplicado que no está en el repositorio.
select m.version as "Registrada sin fichero en el repo"
  from supabase_migrations.schema_migrations m
 where m.version not in (
   '20260717180001','20260717180002','20260717180003','20260717180004',
   '20260717180005','20260717180006','20260717180007','20260717180008',
   '20260717180009','20260718090001','20260718090002','20260718140001',
   '20260718170001','20260718200001','20260718230001','20260721090001',
   '20260723110001','20260725090001','20260725100001','20260807120001',
   '20260807120002','20260807120003','20260807120004','20260807130001',
   '20260807140001','20260809100001')
 order by m.version;


-- ── BLOQUE 3 · Lo que un replay de migraciones antiguas puede haber roto ────
-- 20260725090001 redefine handle_new_user a la versión SIN app_metadata, y
-- 20260807120001 la vuelve a corregir. Si el push se cortó entre las dos, el
-- rol ha dejado de escribirse y ninguna cuenta nueva puede entrar.
with c as (

select 1 as n,
       'handle_new_user escribe raw_app_meta_data' as comprobacion,
       'sí — si dice NO, está roto el alta'        as esperado,
       case
         when to_regprocedure('public.handle_new_user()') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.handle_new_user()'::regprocedure)
              like '%raw_app_meta_data%' then 'sí'
         else '🔴 NO — regresión'
       end as real

union all
select 2,
       'handle_new_user asigna patient por defecto',
       'sí',
       case
         when to_regprocedure('public.handle_new_user()') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.handle_new_user()'::regprocedure)
              like '%''patient''%' then 'sí'
         else '🔴 NO — regresión'
       end

union all
select 3,
       'accept_invitation marca el GUC terapia.linking_patient',
       'sí — si dice NO, el canje fallará',
       case
         when to_regprocedure('public.accept_invitation(text)') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.accept_invitation(text)'::regprocedure)
              like '%linking_patient%' then 'sí'
         else '🔴 NO — regresión'
       end

union all
select 4,
       'accept_invitation comprueba el correo (errcode P0002)',
       'sí',
       case
         when to_regprocedure('public.accept_invitation(text)') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.accept_invitation(text)'::regprocedure)
              like '%P0002%' then 'sí'
         else '🔴 NO — regresión'
       end

union all
select 5,
       'invitation_preview oculta el nombre del profesional',
       'sí',
       case
         when to_regprocedure('public.invitation_preview(text)') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.invitation_preview(text)'::regprocedure)
              like '%null::text%' then 'sí'
         else '🔴 NO — regresión'
       end

union all
select 6,
       'patients_guard protege user_id',
       'sí',
       case
         when to_regprocedure('public.patients_guard()') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.patients_guard()'::regprocedure)
              like '%linking_patient%' then 'sí'
         else '🔴 NO — regresión'
       end

union all
select 7,
       'compute_scale_response rechaza respuestas incompletas',
       'sí (errcode P0010)',
       case
         when to_regprocedure('public.compute_scale_response()') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.compute_scale_response()'::regprocedure)
              like '%P0010%' then 'sí'
         else '🔴 NO — regresión'
       end

union all
select 8,
       'unsettle_appointment devuelve texto',
       'text',
       case
         when to_regprocedure('public.unsettle_appointment(uuid)') is null then '🔴 NO EXISTE'
         else pg_get_function_result('public.unsettle_appointment(uuid)'::regprocedure)
       end

union all
select 9,
       'settle_attended_appointment existe (liquidación transaccional)',
       'existe',
       case
         when to_regprocedure('public.settle_attended_appointment(uuid)') is null
           then '🔴 NO EXISTE'
         else 'existe'
       end

union all
select 10,
       'Índice único de un pago por cita',
       'existe',
       case when exists (
              select 1 from pg_indexes
               where tablename='payments'
                 and indexname='payments_appointment_unique')
            then 'existe' else '🔴 no existe' end

union all
select 11,
       'files_select_owner (política permisiva vieja)',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where schemaname='storage' and tablename='objects'
                 and policyname='files_select_owner')
            then '🔴 HA VUELTO' else 'eliminada' end

union all
select 12,
       'professionals_insert_self (autoregistro)',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where tablename='professionals'
                 and policyname='professionals_insert_self')
            then '🔴 HA VUELTO' else 'eliminada' end

union all
select 13,
       'patients_update_self',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where tablename='patients' and policyname='patients_update_self')
            then '🔴 HA VUELTO' else 'eliminada' end

union all
select 14,
       'Usuarios sin rol en app_metadata',
       '0',
       (select count(*)::text from auth.users u
         where coalesce(u.raw_app_meta_data ->> 'role','')
               not in ('professional','patient'))

union all
select 15,
       'Plantillas de consentimiento activas (1 por profesional)',
       'tantas como profesionales',
       (select count(*)::text || ' de ' ||
               (select count(*)::text from public.professionals)
          from public.consent_templates where active)

)
select n as "#", comprobacion as "Comprobación", esperado as "Esperado", real as "Real"
  from c order by n;
