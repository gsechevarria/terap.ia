> Actualización de la copia de correcciones, 10-sep-2026: las once migraciones
> `20260909190001`–`20260909190011` están verificadas en PostgreSQL embebido y
> **no están aplicadas al proyecto remoto**. El estado remoto que se relata
> abajo es histórico y no se ha vuelto a comprobar. Las nuevas migraciones
> se ejecutan una sola vez por el historial de Supabase; no son scripts para
> reejecutar manualmente. Véase [el informe actual](CORRECCIONES-2026-09.md).

# Migraciones de la auditoría (ago 2026)

Orden de aplicación y qué verificar después de cada una.

> **Regla general:** aplica de una en una y comprueba antes de seguir. Todas son
> idempotentes, así que reejecutar una no rompe nada.

## Estado a 9-ago-2026 — ✅ LAS SEIS APLICADAS

Verificado ejecutando `npm run gen:types` contra el proyecto remoto: el esquema
generado trae todas las columnas y funciones de las seis migraciones
(`content_body`, `deleted_at`, `prorrata_iva_pct`, `tipo_iva_repercutido`,
`acknowledged_at`, `acknowledged_by`, `settle_attended_appointment`,
`unsettle_appointment`, `retry_count`, `next_attempt_at`, `fecha_efectiva`).

| # | Migración | Estado |
|---|---|---|
| 1 | `20260807120001_role_in_app_metadata` | ✅ aplicada |
| 2 | `20260807120002_invitation_hardening` | ✅ aplicada |
| 3 | `20260807120003_storage_hardening` | ✅ aplicada |
| 4 | `20260807120004_data_integrity` | ✅ aplicada |
| 5 | `20260807130001_pagos_fiscal_escalas` | ✅ aplicada |
| 6 | `20260807140001_rendimiento` | ✅ aplicada |
| 7 | `20260809100001_unsettle_informativo` | 🔴 **PENDIENTE** |

`src/lib/database.types.ts` está **regenerado** desde el remoto (ya no hay tipos
escritos a mano).

**Historial del CLI: ✅ reparado** (9-ago-2026). Las 25 migraciones del
repositorio constan como aplicadas en `supabase_migrations.schema_migrations`,
así que `supabase db push` y `supabase migration list` ya dicen la verdad.

**Lo que sigue pendiente:** las **verificaciones funcionales** de cada
migración, más abajo. No se sustituyen por que el esquema exista: que la columna
esté no demuestra que la RLS haga lo que debe.

El SQL de cada una está en [`supabase/migrations/`](../supabase/migrations/),
que es la única fuente de verdad.

Las secciones de abajo se conservan como registro de qué hizo cada una y qué
comprobar.

---

## 0. BLOQUEANTES previos (no son migraciones nuevas)

### 0.a · Reparar el historial de migraciones — ✅ hecho (9-ago-2026)

Varias migraciones se aplicaron desde el editor SQL del panel, que no actualiza
`supabase_migrations.schema_migrations`, así que el CLI las veía pendientes. Ya
están registradas las 25.

Si vuelve a pasar (cualquier migración aplicada por el panel), el arreglo es:

```bash
supabase migration repair --status applied <version> ...
supabase migration list
```

o, sin CLI, [`supabase/scripts/reparar-historial.sql`](../supabase/scripts/reparar-historial.sql), que trae un diagnóstico de
qué falta.

### 0.b · Backfill del rol — ✅ ya aplicado (era el bloqueante principal)

Va dentro de la migración `20260807120001` (punto 1), que ya está aplicada.

Se conserva la nota porque el orden importaba: la migración tenía que ir **antes**
del despliegue del código, ya que `getUserRole` dejó de leer `user_metadata` y
todas las cuentas existentes tenían el rol solo ahí. Si en algún momento
restauras una copia de seguridad anterior a esa migración, vuelve a aplicarla
antes de desplegar.

---

## 1. `20260807120001_role_in_app_metadata.sql`

**Qué hace:** copia el rol de `user_metadata` a `app_metadata` (backfill, con dos
pasadas de red de seguridad basadas en tener fila en `professionals`/`patients`);
`handle_new_user` pasa a escribir `raw_app_meta_data`; elimina la política
`professionals_insert_self`.

**Por qué:** `user_metadata` es de escritura libre para el propio usuario
(`updateUser({ data: { role } })`), y `getUserRole` es toda la autorización de la
app por encima de la RLS.

**Verificar después:**

```sql
-- Nadie con fila en professionals/patients puede quedarse sin rol.
select count(*) from auth.users u
 where coalesce(u.raw_app_meta_data->>'role','') not in ('professional','patient')
   and (exists (select 1 from public.professionals p where p.user_id = u.id)
     or exists (select 1 from public.patients p where p.user_id = u.id));
-- Debe devolver 0.

-- La política ya no existe.
select count(*) from pg_policies
 where tablename = 'professionals' and policyname = 'professionals_insert_self';
-- Debe devolver 0.
```

Y a mano: **entra tú al panel**. Si no puedes, no despliegues nada más.

---

## 2. `20260807120002_invitation_hardening.sql`

**Qué hace:** `invitations_all_by_professional` valida también `patient_id`;
`accept_invitation` exige sesión, correo coincidente y ficha libre, con `revoke`
a `anon`; `invitation_preview` solo responde a invitaciones vivas y ya no
devuelve el nombre del profesional; caducidad de 7 días a 72 h.

**Verificar después:**

```sql
-- anon ya no puede ejecutar accept_invitation.
select has_function_privilege('anon', 'public.accept_invitation(text)', 'execute');
-- Debe ser false.

select column_default from information_schema.columns
 where table_name = 'invitations' and column_name = 'expires_at';
-- Debe mencionar '72:00:00'.
```

A mano: crea una invitación para un paciente **con correo**, cánjeala con ese
correo (debe funcionar) y con otro distinto (debe dar "Esta invitación se envió a
otra dirección de correo").

⚠️ Los pacientes **sin correo en la ficha** ya no se pueden invitar: la app lo
avisa al generar el enlace.

---

## 3. `20260807120003_storage_hardening.sql`

**Qué hace:** las políticas de `storage.objects` respetan
`documents.shared_with_patient`; los primeros segmentos de ruta se comparan como
texto (no con `::uuid`); límites de tamaño y MIME en `files` y `receipts`.

**Verificar después:**

```sql
select id, file_size_limit, allowed_mime_types
  from storage.buckets where id in ('files','receipts');
```

A mano, con una sesión de **paciente**:

```js
const { data } = await supabase.storage.from('files').list('<su patientId>')
```

Debe devolver **solo** documentos compartidos y sus recursos, no el expediente
entero.

---

## 4. `20260807120004_data_integrity.sql`

**Qué hace:** `on delete restrict` en `professionals.user_id` y en
`scale_responses.assignment_id`; `patients_guard` protege también `user_id`;
unicidades (tarifa por defecto, token push, una entrada de diario por día, un
consentimiento por paciente, versión de plantilla); plantillas de consentimiento
inmutables una vez firmadas; `consents.content_body`.

⚠️ **Borra filas duplicadas** en `device_push_tokens` y `mood_entries` antes de
crear los índices únicos. Con datos ficticios no debería haber ninguna, pero
cuenta antes si quieres estar seguro:

```sql
select token, count(*) from public.device_push_tokens group by token having count(*) > 1;
select patient_id, entry_date, count(*) from public.mood_entries
 group by 1,2 having count(*) > 1;
```

**Después de aplicarla: `npm run gen:types`.** Añade `consents.content_body` y
`professionals.deleted_at`, que están puestos a mano en `database.types.ts`.

---

## 5. `20260807130001_pagos_fiscal_escalas.sql`

**Qué hace:** índice único `payments(appointment_id)` + RPC
`settle_attended_appointment` y `unsettle_appointment`; la vista
`v_ingresos_fiscales` separa base e IVA repercutido y devuelve la fecha **en hora
española**; `configuracion_fiscal` gana `tipo_iva_repercutido` y
`prorrata_iva_pct`; el trigger de escalas exige la respuesta completa y en rango;
alerta `scale_flag` al profesional; acuse de recibo en `scale_responses`.

⚠️ **Deduplica pagos por cita** antes de crear el índice único. Comprueba antes
cuántos hay:

```sql
select appointment_id, count(*) from public.payments
 where appointment_id is not null group by 1 having count(*) > 1;
```

🔴 **Esta migración CAMBIA CIFRAS YA MOSTRADAS.** Ver el detalle en la sección
"Cambios fiscales que necesitan validación" de `CLAUDE.md`. En resumen: si tu
actividad está marcada como `sujeta` o `mixta`, el rendimiento neto y los pagos
fraccionados **bajarán** (antes se contaba el IVA como ingreso).

**Después de aplicarla: `npm run gen:types`** (`acknowledged_at`,
`acknowledged_by`, `tipo_iva_repercutido`, `prorrata_iva_pct` y las dos RPC
nuevas están puestos a mano).

**Verificar después:**

```sql
-- La vista devuelve una `date`, no un timestamptz.
select fecha, pg_typeof(fecha) from public.v_ingresos_fiscales limit 1;

-- Un PHQ-9 incompleto debe ser RECHAZADO (esto tiene que fallar):
--   insert into scale_responses (assignment_id, patient_id, scale_id, answers)
--   values ('<id>', '<id>', '<id>', '{"1":0,"2":0,"3":0}');
```

A mano: marca una cita como "acudió" **dos veces seguidas** y comprueba que solo
se crea un pago; luego cámbiala a "no acudió" y comprueba que el pago desaparece
y el bono recupera la sesión.

---

## 6. `20260807140001_rendimiento.sql`

**Qué hace:** `notifications.retry_count`/`next_attempt_at`;
`payments.fecha_efectiva` (columna generada) con su índice; índices de claves
foráneas y compuestos; reescritura de cuatro políticas RLS para que el helper se
evalúe una vez por consulta y no por fila.

**Después de aplicarla: `npm run gen:types`** (`retry_count`, `next_attempt_at`,
`fecha_efectiva`).

**Verificar después.** Aquí no puedo afirmar ninguna mejora: no he medido contra
el remoto. Ejecuta tú esto, con una sesión de profesional real (no desde el
editor SQL, que corre como `postgres` y salta la RLS):

```sql
explain (analyze, buffers)
select * from public.mood_entries
 where patient_id in (select id from public.patients
                       where professional_id = public.current_professional_id());

explain (analyze, buffers)
select * from public.scale_responses order by submitted_at desc limit 100;
```

Lo que hay que ver: el helper como **InitPlan** (una sola evaluación) en vez de
un `SubPlan` por fila, y uso de `scale_responses_pat_sub_idx`.

---

---

## 7. `20260809100001_unsettle_informativo.sql` 🔴 PENDIENTE

**Qué hace:** `unsettle_appointment` pasa de `void` a devolver `text` con lo que
ha hecho: `sin_pago`, `bono_devuelto`, `borrado` o `conservado_cobrado`.

**Por qué:** salió probando a mano. Al corregir un "acudió" a "no acudió", el
pago a veces no desaparecía y la aplicación no decía nada. La causa es una
decisión deliberada —no borrar un pago YA marcado como cobrado, porque destruiría
el registro de un cobro real— pero se tomaba **en silencio**, y desde fuera era
indistinguible de un fallo. Ahora el modal de la cita muestra el aviso y enlaza a
la pestaña Pagos de la ficha.

De paso corrige otra cosa que salía del mismo caso: al deshacer un "acudió", la
cita se quedaba con `status = 'completed'`. Ahora vuelve a `confirmed`.

**Después:** `npm run gen:types` (el tipo de retorno de la RPC está puesto a mano).

**Verificar a mano**, que es como apareció:

1. Cita sin bono → marcar "acudió" → se crea un pago **pendiente**.
2. Marcar "no acudió" → el pago **desaparece** y la cita deja de estar completada.
3. Repetir, pero marcando antes el pago como **cobrado** en la pestaña Pagos.
   Al poner "no acudió", el pago **se conserva** y aparece el aviso explicándolo.

Si en el paso 2 el pago no desaparece, ejecuta esto para ver en qué estado está:

```sql
select p.id, p.status, p.amount_cents, p.session_pack_id, p.note
  from public.payments p
 where p.appointment_id = '<id de la cita>';
```

- `status='pending'` y sin `session_pack_id` → debería haberse borrado.
- `session_pack_id` no nulo → debería haberse borrado y devuelto la sesión.
- `status='paid'` sin `session_pack_id` → **conservado a propósito**, con aviso.

## Orden resumido

```
0.a  supabase migration repair (historial del CLI)  ✅ hecho
1.   20260807120001_role_in_app_metadata.sql    ✅ aplicada
2.   20260807120002_invitation_hardening.sql    ✅ aplicada
3.   20260807120003_storage_hardening.sql       ✅ aplicada
4.   20260807120004_data_integrity.sql          ✅ aplicada
5.   20260807130001_pagos_fiscal_escalas.sql    ✅ aplicada
6.   20260807140001_rendimiento.sql             ✅ aplicada
     npm run gen:types                          ✅ hecho
7.   20260809100001_unsettle_informativo.sql    🔴 PENDIENTE → npm run gen:types
```

Y después: `npm run test:integration` contra Supabase local (ver README), no
contra el remoto.
