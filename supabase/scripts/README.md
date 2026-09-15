# `supabase/scripts/` — SQL que NO es una migración

Aquí van utilidades de mantenimiento que se ejecutan a mano y **no deben formar
parte del historial de migraciones**. Por eso están fuera de
`supabase/migrations/`: si estuvieran dentro, `supabase db push` intentaría
aplicarlas como si fueran cambios de esquema.

## `reparar-historial.sql` — GENERADO, no editar a mano

Equivale a `supabase migration repair --status applied <version> ...`, para
cuando no tienes el CLI a mano y trabajas desde el editor SQL del panel.

**Cuándo hace falta:** aplicar una migración pegándola en el panel **no**
actualiza `supabase_migrations.schema_migrations`, así que el CLI la sigue
viendo pendiente y un `db push` futuro intentaría reejecutarla.

Trae un diagnóstico que compara todas las migraciones del repositorio con lo
registrado y marca cada una como registrada o en rojo. Ejecuta ese bloque
primero y repara solo lo que falte.

**Se regenera con `node scripts/gen-reparar-historial.mjs`**, que lee
`supabase/migrations/` y reescribe el fichero. La versión anterior llevaba la
lista a mano y se quedó en 26 de 41: su verificación afirmaba «debe salir 26»
cuando ya había quince migraciones más, así que daba por bueno un historial
incompleto. Cada vez que se añada una migración, hay que regenerarlo.

⚠️ **Nunca marques como aplicada una migración que no lo esté**: `db push` la
saltaría para siempre y el esquema quedaría incompleto sin ningún aviso.

> Estado a 9-ago-2026: historial reparado, las 25 migraciones de entonces
> constan como aplicadas. El script se conserva porque el desajuste se repite
> cada vez que se aplica algo desde el panel.

## Regularización de los históricos de demostración

Tres scripts aplican los criterios de
[`docs/DIAGNOSTICO-HISTORICOS.md`](../../docs/DIAGNOSTICO-HISTORICOS.md) a los
datos ficticios que quedaron sin tratamiento fiscal al añadirse las columnas
correspondientes. Todos empiezan por un bloque de **solo lectura** que te dice
qué tocarían, y llevan un `rollback` comentado para ensayarlos sin efecto.

| Script | Criterio | Orden |
|---|---|---|
| `regularizar-ingresos-demo.sql` | A1 — tratamiento fiscal de los cobros históricos | independiente |
| `regularizar-gastos-demo.sql` | B1 — `iva_recuperable_pct` con la regla de `save_expense` | **antes** que el de bienes |
| `revisar-bienes-demo.sql` | C1 — recalcular el valor de adquisición y cerrar la revisión | después del de gastos |

⚠️ **Son para el entorno de demostración.** Sobre datos reales, dar por bueno el
criterio fiscal de un cobro pasado es inventarlo: ahí cada cobro se confirma uno
a uno desde la pestaña Pagos de la ficha del paciente, y cada bien se revisa
reguardando su gasto de origen.

Mientras queden filas pendientes, `/pro/contabilidad` y su exportación fallan a
propósito: las guardas de `src/lib/queries/contabilidad.ts` se niegan a calcular
con históricos sin confirmar.

## Cuadre del estado de los pagos

`cuadrar-estado-pagos.sql` marca como cobrados los pagos que ya tenían método
de cobro pero seguían en pendiente. Desde el 15-sep el método manda sobre el
estado, pero solo al cambiar el desplegable: los que ya estaban puestos no se
arreglan solos, y volver a elegir el mismo método no dispara nada.

Empieza por el bloque de solo lectura. No toca las imputaciones de bono, cuyo
estado lo gestiona la liquidación de la cita.

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
