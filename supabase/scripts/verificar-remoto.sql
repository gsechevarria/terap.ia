-- =============================================================================
-- Verificación del estado real del remoto — terap.ia / terap-app
-- 9-ago-2026
--
-- SOLO LECTURA. No escribe nada. Pegar entero en el editor SQL del panel de
-- Supabase y ejecutar. Devuelve una tabla con una fila por comprobación.
--
-- Lo que este script NO puede ver: la configuración de Auth (captcha, longitud
-- de contraseña, duración de sesión, redirect urls). Eso vive en GoTrue, no en
-- Postgres, y se comprueba en el dashboard. Ver el paso 2 del plan.
-- =============================================================================

with c as (

-- ── Historial de migraciones ────────────────────────────────────────────────
select 1 as n,
       'Migraciones registradas en el historial del CLI' as comprobacion,
       '26 (25 + la de unsettle)'                        as esperado,
       count(*)::text                                    as real
  from supabase_migrations.schema_migrations

union all
select 2,
       'Última migración registrada',
       '20260809100001',
       coalesce(max(version), '(ninguna)')
  from supabase_migrations.schema_migrations

union all
select 3,
       'unsettle_appointment devuelve texto (mig. 20260809100001)',
       'text',
       case
         when to_regprocedure('public.unsettle_appointment(uuid)') is null
           then '🔴 NO EXISTE'
         else pg_get_function_result('public.unsettle_appointment(uuid)'::regprocedure)
       end

-- ── Rol en app_metadata ─────────────────────────────────────────────────────
union all
select 10,
       'handle_new_user escribe raw_app_meta_data',
       'sí',
       case
         when to_regprocedure('public.handle_new_user()') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.handle_new_user()'::regprocedure)
              like '%raw_app_meta_data%' then 'sí'
         else '🔴 no'
       end

union all
select 11,
       'Usuarios SIN rol en app_metadata (backfill pendiente)',
       '0',
       count(*)::text
  from auth.users u
 where coalesce(u.raw_app_meta_data ->> 'role', '') not in ('professional','patient')

union all
select 12,
       'Cuentas huérfanas: rol patient sin ficha en patients',
       '0 (basura de Auth conocida)',
       count(*)::text
  from auth.users u
 where u.raw_app_meta_data ->> 'role' = 'patient'
   and not exists (select 1 from public.patients p where p.user_id = u.id)

union all
select 13,
       'Política professionals_insert_self (autoregistro)',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where schemaname='public' and tablename='professionals'
                 and policyname='professionals_insert_self')
            then '🔴 SIGUE EXISTIENDO' else 'eliminada' end

-- ── Invitaciones ────────────────────────────────────────────────────────────
union all
select 20,
       'invitations.token en claro',
       'eliminada',
       case when exists (
              select 1 from information_schema.columns
               where table_schema='public' and table_name='invitations'
                 and column_name='token')
            then '🔴 SIGUE EXISTIENDO' else 'eliminada' end

union all
select 21,
       'invitations.code (código de 6 dígitos)',
       'aún no existe — la crea la Fase 3',
       case when exists (
              select 1 from information_schema.columns
               where table_schema='public' and table_name='invitations'
                 and column_name='code')
            then 'ya existe' else 'no existe' end

union all
select 22,
       'Caducidad por defecto de una invitación',
       '72 horas',
       coalesce((select column_default from information_schema.columns
                  where table_schema='public' and table_name='invitations'
                    and column_name='expires_at'), '(sin default)')

union all
select 23,
       'accept_invitation ejecutable por anon',
       'NO',
       case
         when to_regprocedure('public.accept_invitation(text)') is null
           then '🔴 NO EXISTE'
         when has_function_privilege('anon','public.accept_invitation(text)','execute')
           then '🔴 SÍ — agujero abierto'
         else 'no'
       end

union all
select 24,
       'accept_invitation comprueba el correo del destinatario',
       'sí',
       case
         when to_regprocedure('public.accept_invitation(text)') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.accept_invitation(text)'::regprocedure)
              like '%P0002%' then 'sí'
         else '🔴 no'
       end

union all
select 25,
       'patients_guard protege user_id con el GUC terapia.linking_patient',
       'sí',
       case
         when to_regprocedure('public.patients_guard()') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.patients_guard()'::regprocedure)
              like '%linking_patient%' then 'sí'
         else '🔴 no'
       end

union all
select 26,
       'invitation_preview devuelve el nombre del profesional',
       'NO (se quitó en 20260807120002)',
       case
         when to_regprocedure('public.invitation_preview(text)') is null then '🔴 NO EXISTE'
         when pg_get_functiondef('public.invitation_preview(text)'::regprocedure)
              like '%null::text%' then 'no'
         else '🔴 sí — lo sigue devolviendo'
       end

union all
select 27,
       'Invitaciones vivas sin correo (serían incanjeables)',
       '0',
       count(*)::text
  from public.invitations
 where accepted_at is null and expires_at > now() and email is null

-- ── RPCs del paciente ───────────────────────────────────────────────────────
union all
select 30,
       'RPCs del paciente presentes',
       'las 3',
       (select string_agg(p.proname, ', ' order by p.proname)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname='public'
           and p.proname in ('accept_invitation','patient_accept_consent',
                             'patient_respond_appointment'))

union all
select 31,
       'patients_update_self (el paciente editaba su ficha)',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where tablename='patients' and policyname='patients_update_self')
            then '🔴 SIGUE EXISTIENDO' else 'eliminada' end

union all
select 32,
       'appointments_update_by_patient',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where tablename='appointments'
                 and policyname='appointments_update_by_patient')
            then '🔴 SIGUE EXISTIENDO' else 'eliminada' end

-- ── Diario y escalas ────────────────────────────────────────────────────────
union all
select 40,
       'mood_entries: INSERT usa current_date (UTC — bug de madrugada)',
       'sí hoy; lo corrige la Fase 6',
       coalesce((select case when with_check like '%current_date%'
                             then 'sí — usa current_date'
                             else with_check end
                   from pg_policies
                  where tablename='mood_entries'
                    and policyname='mood_entries_insert_by_patient'),
                '🔴 política ausente')

union all
select 41,
       'mood_entries: índice único por (patient_id, entry_date)',
       'existe',
       case when exists (
              select 1 from pg_indexes
               where tablename='mood_entries'
                 and indexname='mood_entries_patient_day_uq')
            then 'existe' else '🔴 no existe' end

union all
select 42,
       'scale_responses: INSERT exige submitted_at reciente (±5 min)',
       'sí',
       case when exists (
              select 1 from pg_policies
               where tablename='scale_responses'
                 and policyname='scale_responses_insert_by_patient'
                 and with_check like '%submitted_at%')
            then 'sí' else '🔴 no' end

union all
select 43,
       'Trigger que avisa al profesional del ítem de riesgo',
       'existe',
       case when exists (
              select 1 from pg_trigger
               where tgname='scale_responses_notify_flag' and not tgisinternal)
            then 'existe' else '🔴 no existe' end

-- ── Push ────────────────────────────────────────────────────────────────────
union all
select 50,
       'device_push_tokens: índice único por token',
       'existe (el panel hace onConflict a la constraint vieja → Fase 6)',
       case when exists (
              select 1 from pg_indexes
               where tablename='device_push_tokens'
                 and indexname='device_push_tokens_token_uq')
            then 'existe' else '🔴 no existe' end

union all
select 51,
       'device_push_tokens: constraint antigua (user_id, token)',
       'eliminada',
       case when exists (
              select 1 from pg_constraint
               where conname='device_push_tokens_user_id_token_key')
            then 'sigue existiendo' else 'eliminada' end

-- ── Storage ─────────────────────────────────────────────────────────────────
union all
select 60,
       'Bucket files: tope de tamaño',
       '20971520 (20 MB)',
       coalesce((select file_size_limit::text from storage.buckets where id='files'),
                '🔴 sin tope')

union all
select 61,
       'Bucket files: lista blanca de MIME',
       'definida',
       coalesce((select array_length(allowed_mime_types,1)::text || ' tipos'
                   from storage.buckets where id='files'),
                '🔴 sin lista — se puede subir HTML/SVG activo')

union all
select 62,
       'Políticas de lectura del bucket files',
       'files_select_professional + files_select_patient_shared',
       coalesce((select string_agg(policyname, ', ' order by policyname)
                   from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname like 'files_select%'),
                '🔴 ninguna')

union all
select 63,
       'files_select_owner (la política vieja, permisiva)',
       'eliminada',
       case when exists (
              select 1 from pg_policies
               where schemaname='storage' and tablename='objects'
                 and policyname='files_select_owner')
            then '🔴 SIGUE EXISTIENDO' else 'eliminada' end

-- ── RLS general ─────────────────────────────────────────────────────────────
union all
select 70,
       'Tablas de public SIN RLS activada',
       '0',
       coalesce((select string_agg(c2.relname, ', ')
                   from pg_class c2 join pg_namespace n on n.oid = c2.relnamespace
                  where n.nspname='public' and c2.relkind='r' and not c2.relrowsecurity),
                '0 — todas la tienen')

union all
select 71,
       'Datos actuales: pacientes con cuenta vinculada',
       '(informativo)',
       (select count(*)::text from public.patients where user_id is not null)

)
select n as "#", comprobacion as "Comprobación", esperado as "Esperado", real as "Real"
  from c
 order by n;
