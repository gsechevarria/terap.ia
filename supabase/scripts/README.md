# `supabase/scripts/` — SQL que NO es una migración

Aquí van utilidades de mantenimiento que se ejecutan a mano y **no deben formar
parte del historial de migraciones**. Por eso están fuera de
`supabase/migrations/`: si estuvieran dentro, `supabase db push` intentaría
aplicarlas como si fueran cambios de esquema.

## `reparar-historial.sql`

Equivale a `supabase migration repair --status applied <version> ...`, para
cuando no tienes el CLI a mano y trabajas desde el editor SQL del panel.

**Cuándo hace falta:** aplicar una migración pegándola en el panel **no**
actualiza `supabase_migrations.schema_migrations`, así que el CLI la sigue
viendo pendiente y un `db push` futuro intentaría reejecutarla.

Trae un diagnóstico que compara todas las migraciones del repositorio con lo
registrado y marca cada una `✅ registrada` / `❌ FALTA`. Ejecuta ese bloque
primero y repara solo lo que salga en rojo.

⚠️ **Nunca marques como aplicada una migración que no lo esté**: `db push` la
saltaría para siempre y el esquema quedaría incompleto sin ningún aviso.

> Estado a 9-ago-2026: historial reparado, las 25 migraciones de entonces
> constan como aplicadas. El script se conserva porque el desajuste se repite
> cada vez que se aplica algo desde el panel.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Migraciones de esquema | `supabase/migrations/` — **única fuente de verdad** |
| Utilidades de mantenimiento | `supabase/scripts/` (esta carpeta) |
| Qué hace cada migración y cómo verificarla | `docs/MIGRACIONES-PENDIENTES.md` |
| Configuración local del CLI | `supabase/config.toml` |

Hubo un tiempo una carpeta `migrations/` en la raíz con copias para pegar en el
panel. Se eliminó: dos copias del mismo SQL acaban divergiendo. Si necesitas el
SQL de una migración, cógelo de `supabase/migrations/`.
