# Migraciones de la auditoría (ago 2026) — copia para aplicar a mano

Copia de las seis migraciones de `supabase/migrations/`, juntas aquí para
pegarlas cómodamente en el **editor SQL del panel de Supabase**.

> La fuente de verdad sigue siendo `supabase/migrations/`. Esta carpeta es solo
> una copia de conveniencia: si editas algo, edítalo allí.

**Todas son idempotentes y reejecutables.** Si tienes dudas de si una se aplicó,
vuelve a lanzarla: no rompe nada.

---

## Estado — ✅ las seis aplicadas (9-ago-2026)

Verificado con `npm run gen:types`: el esquema del remoto trae todas las
columnas y funciones de las seis. `src/lib/database.types.ts` está regenerado.

| # | Fichero | Estado |
|---|---|---|
| 1 | `20260807120001_role_in_app_metadata.sql` | ✅ aplicada |
| 2 | `20260807120002_invitation_hardening.sql` | ✅ aplicada |
| 3 | `20260807120003_storage_hardening.sql` | ✅ aplicada |
| 4 | `20260807120004_data_integrity.sql` | ✅ aplicada |
| 5 | `20260807130001_pagos_fiscal_escalas.sql` | ✅ aplicada |
| 6 | `20260807140001_rendimiento.sql` | ✅ aplicada |

Esta carpeta queda como copia por si hay que reaplicar alguna (son idempotentes)
o restaurar una copia de seguridad anterior.

**Lo que el esquema NO demuestra:** que la columna exista no prueba que la RLS
haga lo que debe. Las comprobaciones funcionales de abajo siguen pendientes.

---

## Comprobaciones funcionales pendientes

Ya aplicadas todas, queda verificar el **comportamiento**. Esto es lo que de
verdad importa y no se deduce del esquema.

### 5 · `20260807130001_pagos_fiscal_escalas.sql`

Liquidación atómica de citas, vista fiscal con IVA y fecha española, trigger de
escalas endurecido y alerta del ítem de riesgo.

**Comprobar:**

```sql
-- La vista devuelve una `date` (hora española), no un timestamptz.
select fecha, pg_typeof(fecha) from public.v_ingresos_fiscales limit 1;

-- Las dos RPC nuevas existen y anon NO puede ejecutarlas.
select has_function_privilege('anon','public.settle_attended_appointment(uuid)','execute');
select has_function_privilege('anon','public.unsettle_appointment(uuid)','execute');
-- Ambas deben ser false.
```

Y a mano, en la app: marca una cita como **"acudió" dos veces seguidas** y
comprueba que solo se crea un pago; después cámbiala a **"no acudió"** y
comprueba que el pago desaparece y el bono recupera la sesión.

🟡 **Esta migración cambia cifras ya mostradas.** Si tu actividad está marcada
como `sujeta` o `mixta`, el rendimiento neto y los pagos fraccionados bajarán,
porque hasta ahora el IVA repercutido se contaba como ingreso. Con `exenta` —el
caso normal en psicología— no cambia nada. El detalle está en `CLAUDE.md`,
sección "Cambios fiscales que necesitan validación".

### 6 · `20260807140001_rendimiento.sql`

Reintentos en la cola de notificaciones, `payments.fecha_efectiva` para paginar
en SQL, índices de claves foráneas y compuestos, y reescritura de cuatro
políticas RLS.

No afirmo ninguna mejora de rendimiento: no he medido contra tu base. Para
comprobarlo, con una sesión de **profesional real** (no desde el editor SQL, que
corre como `postgres` y salta la RLS):

```sql
explain (analyze, buffers)
select * from public.mood_entries
 where patient_id in (select id from public.patients
                       where professional_id = public.current_professional_id());

explain (analyze, buffers)
select * from public.scale_responses order by submitted_at desc limit 100;
```

Lo que hay que ver: el helper como **InitPlan** (una evaluación por consulta) en
vez de un `SubPlan` por fila, y uso de `scale_responses_pat_sub_idx`.

---

## Tipos — ✅ ya regenerados

`npm run gen:types` se ejecutó el 9-ago-2026 y `src/lib/database.types.ts` viene
ahora del esquema real. Las diferencias contra los tipos que estaban escritos a
mano fueron solo cosméticas (orden alfabético, la clave foránea de
`acknowledged_by` y el formato de los `Args` de las RPC): ningún tipo estaba mal.

---

## Registro del historial — [`00_reparar-historial.sql`](00_reparar-historial.sql)

Aplicar una migración pegándola en el editor SQL **no** actualiza
`supabase_migrations.schema_migrations`, así que el CLI la sigue viendo
pendiente. Con el CLI se arregla así:

```bash
supabase migration repair --status applied 20260725090001 20260725100001
supabase migration list
```

Si prefieres hacerlo desde el panel, `00_reparar-historial.sql` hace lo mismo en
SQL. **No es una migración**: no la copies a `supabase/migrations/`.

Trae un diagnóstico previo que compara las 25 migraciones del repositorio con lo
que el CLI tiene registrado, y marca cada una como `✅ registrada` o `❌ FALTA`.
Ejecútalo primero y repara solo lo que salga en rojo.

⚠️ **Ojo:** si aplicaste las seis de agosto por el editor SQL, también les
faltará el registro, no solo a las dos de julio. El fichero las trae en un
bloque comentado, listo para descomentar si el diagnóstico las marca.

⚠️ **Nunca marques como aplicada una migración que no lo esté.** `db push` la
saltaría para siempre y el esquema quedaría incompleto sin ningún aviso.

---

## Si algo falla

Todas se pueden reejecutar. Los puntos donde una migración **aborta a propósito**
(no es un fallo tuyo, es una comprobación):

- `20260807120001`: nada aborta, pero si el backfill deja usuarios sin rol,
  revisa la consulta de verificación de `docs/MIGRACIONES-PENDIENTES.md`.
- `20260725100001` (ya aplicada): aborta si `pgcrypto` no está en el esquema
  `extensions`.
- `20260807130001`: el trigger nuevo **rechaza** respuestas de escala
  incompletas. Es el comportamiento buscado, no un error.

Guía completa, con el porqué de cada bloque:
[`docs/MIGRACIONES-PENDIENTES.md`](../docs/MIGRACIONES-PENDIENTES.md).
