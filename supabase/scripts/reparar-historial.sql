-- =============================================================================
-- REPARACIÓN DEL HISTORIAL DE MIGRACIONES
--
-- ⚠️ ESTO NO ES UNA MIGRACIÓN. No la copies a `supabase/migrations/` ni dejes
--    que la recoja un `db push`: solo escribe en la tabla de control del CLI.
--
-- Equivale a:
--     supabase migration repair --status applied <version> ...
--
-- PARA QUÉ SIRVE
-- El CLI lleva la cuenta de las migraciones aplicadas en
-- `supabase_migrations.schema_migrations`. Cuando una migración se aplica
-- pegándola en el editor SQL del panel, esa tabla NO se entera: el fichero
-- queda como "pendiente" para el CLI aunque su SQL ya esté en la base.
--
-- Consecuencia: el próximo `supabase db push` intentaría reejecutarlas. Las de
-- este proyecto son idempotentes (se hicieron así en la fase 1 de la
-- auditoría), así que no romperían nada, pero el registro seguiría mal y
-- cualquier `migration list` mentiría.
--
-- CÓMO USARLO
--   1. Ejecuta el PASO 1 y MIRA el resultado.
--   2. Ejecuta el PASO 2 solo para las versiones que salgan como FALTA.
--   3. Vuelve a ejecutar el PASO 1 para confirmar.
--
-- ⚠️ REGLA DE ORO: registra únicamente migraciones que estén REALMENTE
--    aplicadas. Marcar como aplicada una que no lo esté es peor que no
--    registrarla: `db push` la saltará para siempre y el esquema quedará
--    incompleto en silencio.
-- =============================================================================


-- =============================================================================
-- PASO 0 · ¿Existe la tabla de control? (solo lectura)
--
-- Debería existir: este proyecto usó `supabase db push` en las sesiones 1-11.
-- Si devuelve 0 filas, la tabla no está y NO hay nada que reparar — significa
-- que el CLI nunca ha empujado a esta base. En ese caso, para de leer y usa
-- `supabase link` + `supabase migration list` antes de tocar nada.
-- =============================================================================

select table_schema, table_name
  from information_schema.tables
 where table_schema = 'supabase_migrations'
   and table_name = 'schema_migrations';


-- =============================================================================
-- PASO 1 · DIAGNÓSTICO (solo lectura, no cambia nada)
--
-- Compara las 25 migraciones del repositorio con lo que el CLI tiene
-- registrado. Ejecuta este bloque solo y lee la columna `estado`.
-- =============================================================================

with en_disco (version, name) as (
  values
    ('20260717180001', 'types_and_utils'),
    ('20260717180002', 'identity'),
    ('20260717180003', 'tasks'),
    ('20260717180004', 'scales'),
    ('20260717180005', 'appointments'),
    ('20260717180006', 'payments'),
    ('20260717180007', 'wellbeing'),
    ('20260717180008', 'emergency_notifications'),
    ('20260717180009', 'rls_write_hardening'),
    ('20260718090001', 'patient_notes'),
    ('20260718090002', 'invitation_preview'),
    ('20260718140001', 'agenda_blocks'),
    ('20260718170001', 'storage_files'),
    ('20260718200001', 'notifications_prefs'),
    ('20260718230001', 'device_push_tokens'),
    ('20260721090001', 'contabilidad'),
    ('20260723110001', 'patient_contact_fields'),
    ('20260725090001', 'rls_patient_hardening'),
    ('20260725100001', 'invitation_token_hash'),
    ('20260807120001', 'role_in_app_metadata'),
    ('20260807120002', 'invitation_hardening'),
    ('20260807120003', 'storage_hardening'),
    ('20260807120004', 'data_integrity'),
    ('20260807130001', 'pagos_fiscal_escalas'),
    ('20260807140001', 'rendimiento')
)
select
  d.version,
  d.name,
  case when m.version is null then '❌ FALTA' else '✅ registrada' end as estado
from en_disco d
left join supabase_migrations.schema_migrations m on m.version = d.version
order by d.version;


-- =============================================================================
-- PASO 2 · REPARACIÓN
--
-- Descomenta SOLO las líneas de las versiones que el paso 1 marque como FALTA.
--
-- Se usa `where not exists` en vez de `on conflict` para no depender de cómo
-- esté definida la clave de la tabla en tu versión del CLI. Es idempotente:
-- ejecutarlo dos veces no duplica nada.
-- =============================================================================

-- --- 2.a · Las dos de julio, aplicadas por el editor SQL -------------------
--          (son las que documenta la auditoría original)

insert into supabase_migrations.schema_migrations (version)
select v
from (values ('20260725090001'), ('20260725100001')) as t(v)
where not exists (
  select 1 from supabase_migrations.schema_migrations m where m.version = t.v
);


-- --- 2.b · Las seis de agosto (auditoría) -----------------------------------
--
--   Si también las aplicaste pegándolas en el editor SQL, estarán igual de
--   ausentes. Ya está verificado que su esquema ESTÁ en la base: `gen:types`
--   del 9-ago-2026 devolvió todas sus columnas y funciones
--   (content_body, deleted_at, prorrata_iva_pct, tipo_iva_repercutido,
--    acknowledged_at, acknowledged_by, settle_attended_appointment,
--    unsettle_appointment, retry_count, next_attempt_at, fecha_efectiva).
--
--   👉 DESCOMENTA este bloque solo si el PASO 1 las marca como FALTA.

-- insert into supabase_migrations.schema_migrations (version)
-- select v
-- from (values
--   ('20260807120001'),
--   ('20260807120002'),
--   ('20260807120003'),
--   ('20260807120004'),
--   ('20260807130001'),
--   ('20260807140001')
-- ) as t(v)
-- where not exists (
--   select 1 from supabase_migrations.schema_migrations m where m.version = t.v
-- );


-- --- 2.c · Datos de contacto del paciente ------------------------------------
--
--   `20260723110001_patient_contact_fields` quedó en su día como "pendiente de
--   aplicar" en CLAUDE.md, con la opción de pegarla en el editor SQL. Si se
--   aplicó por ahí, también le faltará el registro.
--
--   👉 Antes de descomentar, confirma que las columnas existen de verdad:
--        select column_name from information_schema.columns
--         where table_schema = 'public' and table_name = 'patients'
--           and column_name in ('phone','birth_date','address','profession','emergency_contact');
--      Deben salir las cinco.

-- insert into supabase_migrations.schema_migrations (version)
-- select v
-- from (values ('20260723110001')) as t(v)
-- where not exists (
--   select 1 from supabase_migrations.schema_migrations m where m.version = t.v
-- );


-- =============================================================================
-- PASO 3 · Rellenar el nombre (opcional, cosmético)
--
-- Las versiones recientes del CLI guardan también el nombre de la migración.
-- Si tu tabla no tiene esa columna, este bloque no hace nada en vez de fallar.
-- El nombre solo afecta a lo bonito que se vea `supabase migration list`.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'supabase_migrations'
       and table_name = 'schema_migrations'
       and column_name = 'name'
  ) then
    update supabase_migrations.schema_migrations m
       set name = d.name
      from (values
        ('20260723110001', 'patient_contact_fields'),
        ('20260725090001', 'rls_patient_hardening'),
        ('20260725100001', 'invitation_token_hash'),
        ('20260807120001', 'role_in_app_metadata'),
        ('20260807120002', 'invitation_hardening'),
        ('20260807120003', 'storage_hardening'),
        ('20260807120004', 'data_integrity'),
        ('20260807130001', 'pagos_fiscal_escalas'),
        ('20260807140001', 'rendimiento')
      ) as d(version, name)
     where m.version = d.version
       and m.name is distinct from d.name;
  end if;
end $$;


-- =============================================================================
-- PASO 4 · VERIFICACIÓN
--
-- Vuelve a ejecutar el PASO 1: no debe quedar ningún ❌ FALTA.
-- Y desde tu máquina, con el CLI:
--
--     supabase migration list
--
-- Las columnas Local y Remote deben coincidir en las 25.
-- =============================================================================
