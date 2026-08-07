# Migraciones pendientes — auditoría ago 2026

Orden de aplicación y qué verificar después de cada una.

> **Regla general:** aplica de una en una y comprueba antes de seguir. Todas son
> idempotentes, así que reejecutar una no rompe nada.

---

## 0. BLOQUEANTES previos (no son migraciones nuevas)

### 0.a · Reparar el historial de migraciones — **antes de cualquier `db push`**

`20260725090001` y `20260725100001` se aplicaron desde el editor SQL del panel,
así que `supabase_migrations` no las tiene registradas y el CLI las ve
pendientes. Ya se han hecho reejecutables (fase 1), pero el registro sigue mal:

```bash
supabase migration repair --status applied 20260725090001 20260725100001
supabase migration list   # las dos deben figurar como aplicadas
```

### 0.b · Backfill del rol — 🔴 **sin esto NADIE puede entrar**

Va dentro de la migración `20260807120001` (punto 1). Se destaca aquí porque el
orden importa: **la migración va ANTES del despliegue del código**. `getUserRole`
deja de leer `user_metadata`, y todas las cuentas existentes tienen el rol solo
ahí. Si despliegas primero, te quedas fuera tú también.

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

## Orden resumido

```
0.a  supabase migration repair --status applied 20260725090001 20260725100001
1.   20260807120001_role_in_app_metadata.sql   ← ANTES de desplegar el código
2.   20260807120002_invitation_hardening.sql
3.   20260807120003_storage_hardening.sql
4.   20260807120004_data_integrity.sql          → npm run gen:types
5.   20260807130001_pagos_fiscal_escalas.sql    → npm run gen:types
6.   20260807140001_rendimiento.sql             → npm run gen:types
```

Y después: `npm run test:integration` contra Supabase local (ver README), no
contra el remoto.
