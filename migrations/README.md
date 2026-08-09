# Migraciones de la auditoría (ago 2026) — copia para aplicar a mano

Copia de las seis migraciones de `supabase/migrations/`, juntas aquí para
pegarlas cómodamente en el **editor SQL del panel de Supabase**.

> La fuente de verdad sigue siendo `supabase/migrations/`. Esta carpeta es solo
> una copia de conveniencia: si editas algo, edítalo allí.

**Todas son idempotentes y reejecutables.** Si tienes dudas de si una se aplicó,
vuelve a lanzarla: no rompe nada.

---

## Estado

| # | Fichero | Estado | `gen:types` después |
|---|---|---|---|
| 1 | `20260807120001_role_in_app_metadata.sql` | ✅ me dijiste que ya la lanzaste | no |
| 2 | `20260807120002_invitation_hardening.sql` | ✅ ya lanzada | no |
| 3 | `20260807120003_storage_hardening.sql` | ✅ ya lanzada | no |
| 4 | `20260807120004_data_integrity.sql` | ✅ ya lanzada | **sí** |
| 5 | `20260807130001_pagos_fiscal_escalas.sql` | 🔴 **PENDIENTE** | **sí** |
| 6 | `20260807140001_rendimiento.sql` | 🔴 **PENDIENTE** | **sí** |

Las 1–4 son de la fase 2, que es la que estaba escrita cuando me confirmaste que
habías lanzado los SQL. Las 5 y 6 llegaron con las fases 3 y 4, después de esa
confirmación. **Si tu "ya están lanzados" incluía menos de cuatro, lánzalas
todas en orden: son idempotentes.**

Si la 4 no llegaste a aplicarla, mira su aviso de duplicados antes (abajo).

---

## Orden y qué comprobar

Aplica **de una en una** y verifica antes de seguir.

### 5 · `20260807130001_pagos_fiscal_escalas.sql` 🔴

Liquidación atómica de citas, vista fiscal con IVA y fecha española, trigger de
escalas endurecido y alerta del ítem de riesgo.

**Antes de lanzarla**, comprueba si hay pagos duplicados por cita (la migración
los borra sola, conservando el más antiguo, pero conviene saber cuántos son):

```sql
select appointment_id, count(*)
  from public.payments
 where appointment_id is not null
 group by 1 having count(*) > 1;
```

**Después:**

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

### 6 · `20260807140001_rendimiento.sql` 🔴

Reintentos en la cola de notificaciones, `payments.fecha_efectiva` para paginar
en SQL, índices de claves foráneas y compuestos, y reescritura de cuatro
políticas RLS.

**Después:**

```sql
select column_name from information_schema.columns
 where table_name = 'payments' and column_name = 'fecha_efectiva';
```

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

## Después de aplicar la 5 y la 6

```bash
npm run gen:types
```

`consents.content_body`, `professionals.deleted_at`, `acknowledged_at`,
`acknowledged_by`, `tipo_iva_repercutido`, `prorrata_iva_pct`, `retry_count`,
`next_attempt_at`, `fecha_efectiva` y las RPC nuevas están puestos **a mano** en
`src/lib/database.types.ts` para que el build pase. Regenerarlos confirma que
coinciden con el esquema real.

---

## Registro del historial (independiente de todo lo anterior)

`20260725090001` y `20260725100001` se aplicaron en su día desde el editor SQL,
así que el CLI las sigue viendo pendientes. Antes de cualquier `supabase db push`
futuro:

```bash
supabase migration repair --status applied 20260725090001 20260725100001
supabase migration list
```

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
