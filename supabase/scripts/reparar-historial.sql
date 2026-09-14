-- =============================================================================
-- REPARACIÓN DEL HISTORIAL DE MIGRACIONES
-- Actualizado 9-ago-2026 · cubre las 26 migraciones del repositorio
--
-- ⚠️ ESTO NO ES UNA MIGRACIÓN. No la copies a `supabase/migrations/` ni dejes
--    que la recoja un `db push`: solo escribe en la tabla de control del CLI.
--
-- Equivale a:  supabase migration repair --status applied <version> ...
-- Úsala cuando el CLI no esté a mano o falle la conexión al remoto.
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
-- migración hay que aplicarla de verdad, no marcarla.
-- =============================================================================

select 'invitations.token eliminada (100001 jul)' as efecto,
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
select 'accept_invitation con P0002 (20260807120002)',
       case when to_regprocedure('public.accept_invitation(text)') is not null
             and pg_get_functiondef('public.accept_invitation(text)'::regprocedure)
                 like '%P0002%'
            then 'aplicada' else '🔴 NO' end
union all
select 'files_select_patient_shared (20260807120003)',
       case when exists (select 1 from pg_policies
              where schemaname='storage' and tablename='objects'
                and policyname='files_select_patient_shared')
            then 'aplicada' else '🔴 NO' end
union all
select 'consents.content_body (20260807120004)',
       case when exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='consents'
                and column_name='content_body')
            then 'aplicada' else '🔴 NO' end
union all
select 'scale_responses.acknowledged_at (20260807130001)',
       case when exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='scale_responses'
                and column_name='acknowledged_at')
            then 'aplicada' else '🔴 NO' end
union all
select 'payments.fecha_efectiva (20260807140001)',
       case when exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='payments'
                and column_name='fecha_efectiva')
            then 'aplicada' else '🔴 NO' end
union all
select 'unsettle_appointment devuelve text (20260809100001)',
       case when to_regprocedure('public.unsettle_appointment(uuid)') is not null
             and pg_get_function_result('public.unsettle_appointment(uuid)'::regprocedure) = 'text'
            then 'aplicada' else '🔴 NO' end;


-- =============================================================================
-- PASO 2 · REPARAR (ejecuta solo si el PASO 1 no tiene ningún 🔴)
--
-- Registra de una vez las 26 del repositorio. Idempotente: `where not exists`,
-- así que las que ya consten se quedan como están y ejecutarlo dos veces no
-- duplica nada.
-- =============================================================================

insert into supabase_migrations.schema_migrations (version)
select t.v
  from (values
    ('20260717180001'),('20260717180002'),('20260717180003'),('20260717180004'),
    ('20260717180005'),('20260717180006'),('20260717180007'),('20260717180008'),
    ('20260717180009'),('20260718090001'),('20260718090002'),('20260718140001'),
    ('20260718170001'),('20260718200001'),('20260718230001'),('20260721090001'),
    ('20260723110001'),('20260725090001'),('20260725100001'),('20260807120001'),
    ('20260807120002'),('20260807120003'),('20260807120004'),('20260807130001'),
    ('20260807140001'),('20260809100001')
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
        ('20260809100001','unsettle_informativo')
      ) as d(version, name)
     where m.version = d.version
       and m.name is distinct from d.name;
  end if;
end $$;


-- =============================================================================
-- PASO 4 · VERIFICACIÓN — debe salir 26 y ningún '🔴 FALTA'
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
    ('20260809100001','unsettle_informativo')
)
select d.version as "Versión",
       d.name    as "Migración",
       case when m.version is null then '🔴 FALTA' else 'registrada' end as "Estado"
  from en_disco d
  left join supabase_migrations.schema_migrations m on m.version = d.version
 order by d.version;

-- Total registrado (debe ser 26; si sale más, hay registros sin fichero):
select count(*) as "Total en el historial"
  from supabase_migrations.schema_migrations;
