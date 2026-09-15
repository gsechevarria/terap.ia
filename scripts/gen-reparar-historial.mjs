import { readdirSync, writeFileSync } from "node:fs";

/**
 * Regenera `supabase/scripts/reparar-historial.sql` a partir de los ficheros
 * que hay de verdad en `supabase/migrations/`.
 *
 * El script anterior llevaba la lista a mano y se quedó en 26 de 41: su
 * verificación decía "debe salir 26" cuando el repositorio tenía quince
 * migraciones más, así que daba por bueno un historial incompleto. Generarlo
 * evita que vuelva a envejecer en silencio.
 */
const filas = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => {
    const m = /^(\d+)_(.+)\.sql$/.exec(f);
    if (!m) throw new Error(`Nombre de migración inesperado: ${f}`);
    return { version: m[1], nombre: m[2] };
  });

const lista = (conNombre) =>
  filas
    .map((r) => (conNombre ? `    ('${r.version}','${r.nombre}')` : `    ('${r.version}')`))
    .join(",\n");

const sql = `-- =============================================================================
-- REPARACIÓN DEL HISTORIAL DE MIGRACIONES
-- GENERADO automáticamente desde supabase/migrations/ — ${filas.length} migraciones.
--
-- ⚠️ NO EDITAR A MANO. La versión anterior llevaba la lista escrita a pulso y se
--    quedó en 26 de 41: su verificación afirmaba "debe salir 26" cuando el
--    repositorio ya tenía quince migraciones más, de modo que daba por bueno un
--    historial incompleto. Para regenerarlo:
--
--      node scripts/gen-reparar-historial.mjs
--
-- ⚠️ ESTO NO ES UNA MIGRACIÓN. No la copies a \`supabase/migrations/\` ni dejes
--    que la recoja un \`db push\`: solo escribe en la tabla de control del CLI.
--
-- Equivale a:  supabase migration repair --status applied <version> ...
--
-- PARA QUÉ SIRVE
-- El CLI lleva la cuenta de lo aplicado en
-- \`supabase_migrations.schema_migrations\`. Cuando una migración se aplica
-- pegándola en el editor SQL del panel, esa tabla no se entera: el fichero
-- queda como "pendiente" aunque su SQL ya esté en la base.
--
-- ⚠️ REGLA DE ORO: registra únicamente migraciones REALMENTE aplicadas.
--    Marcar como aplicada una que no lo esté es peor que no registrarla:
--    \`db push\` la saltará para siempre y el esquema quedará incompleto en
--    silencio. El PASO 1 lo comprueba por ti antes de escribir nada.
-- =============================================================================


-- =============================================================================
-- PASO 1 · ¿Están de verdad aplicadas? (solo lectura)
--
-- Comprueba EFECTOS en el esquema, no registros. Si algo sale 🔴, para: esa
-- migración hay que aplicarla de verdad, no marcarla. Son sondas de las
-- migraciones que más cambian el esquema, no de las ${filas.length}.
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
-- Registra las ${filas.length} del repositorio. Idempotente: \`where not exists\`, así
-- que las que ya consten se quedan igual y ejecutarlo dos veces no duplica nada.
-- =============================================================================

insert into supabase_migrations.schema_migrations (version)
select t.v
  from (values
${lista(false)}
  ) as t(v)
 where not exists (
   select 1 from supabase_migrations.schema_migrations m where m.version = t.v
 );


-- =============================================================================
-- PASO 3 · Rellenar el nombre (cosmético)
--
-- Algunas versiones del CLI guardan también el nombre. Si tu tabla no tiene esa
-- columna, este bloque no hace nada en vez de fallar. Solo afecta a lo legible
-- que salga \`supabase migration list\`.
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
${lista(true)}
      ) as d(version, name)
     where m.version = d.version
       and m.name is distinct from d.name;
  end if;
end $$;


-- =============================================================================
-- PASO 4 · VERIFICACIÓN — deben salir ${filas.length} y ningún '🔴 FALTA'
-- =============================================================================

with en_disco (version, name) as (values
${lista(true)}
)
select d.version as "Versión",
       d.name    as "Migración",
       case when m.version is null then '🔴 FALTA' else 'registrada' end as "Estado"
  from en_disco d
  left join supabase_migrations.schema_migrations m on m.version = d.version
 order by d.version;

-- Comparación de recuentos. "en_disco" debe ser ${filas.length} y coincidir con el
-- historial; si el historial tiene MÁS, hay registros sin fichero en el repo.
select
  (select count(*) from (values
${lista(false)}
  ) as t(v))                                                as "En el repositorio",
  (select count(*) from supabase_migrations.schema_migrations) as "En el historial";
`;

writeFileSync("supabase/scripts/reparar-historial.sql", sql);
console.log(`reparar-historial.sql regenerado con ${filas.length} migraciones`);
