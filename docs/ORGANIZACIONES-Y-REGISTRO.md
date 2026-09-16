# Organizaciones, registro e invitaciones

Sistema de alta profesional, organizaciones (consulta individual o centro),
invitaciones de equipo y de paciente, administración de plataforma y acceso
comercial. Rama `feat/organizaciones-registro-invitaciones`.

**Stripe NO cobra ni procesa ningún pago.** No se ha instalado, no hay Checkout,
no hay suscripción ni real ni simulada. Lo único que existe es una capa de
*acceso comercial* por organización (`pending` / `beta` / `suspended`) con dos
columnas reservadas y sin uso (`stripe_customer_id`, `stripe_subscription_id`)
para que incorporarlo después no obligue a rehacer el registro.

---

## 1. El modelo, en una pantalla

| Concepto | Dónde vive | Qué NO es |
|---|---|---|
| Cuenta e identidad | `auth.users` | No dice a qué organización perteneces |
| Perfil y **acreditación** | `professionals.verification_status` | Verificar el correo no acredita nada |
| Organización | `organizations` (`solo` \| `center`) | No es el profesional |
| Pertenencia y permiso **administrativo** | `organization_members.role` | **No da acceso clínico** |
| Expediente | `patients` (+ `organization_id`) | No es la cuenta del paciente |
| Acceso **clínico** | `patient_assignments` | Se concede expediente a expediente |
| Vínculo cuenta ↔ expediente | `patients.user_id` | Se establece solo aceptando una invitación |
| Invitación | `invitations`, `professional_invitations` | El enlace no se consume al abrirlo |
| Acceso comercial | `organization_access` | No es una suscripción de pago |

Dos separaciones que son el corazón del diseño:

- **Administrar ≠ acceder.** Un propietario de centro gestiona el equipo y el
  acceso comercial. Eso no le abre un solo expediente: necesita estar asignado.
- **Rol ≠ contexto.** `app_metadata.role` dice qué *puede* hacer la cuenta.
  Dónde está trabajando lo dicen sus membresías y sus expedientes. Una persona
  puede ser profesional en un centro y paciente en otro, y sus expedientes en
  centros distintos **no se fusionan nunca**.

### Estados de acreditación

| Estado | Opera | La interfaz dice |
|---|---|---|
| `pending` | No | «Tu solicitud está en revisión» |
| `approved` | Sí | «Acreditación verificada» |
| `rejected` | No | «No hemos podido aprobar tu alta» + motivo |
| `provisional` | **Sí** | «Acreditación sin comprobar» |

`provisional` cubre dos casos con la misma propiedad —hubo un acto humano
deliberado pero nadie comprobó un número de colegiado—: las cuentas que ya
existían antes de que hubiera revisión, y las que crea un administrador con
`service_role`. **Nunca se presentan como verificadas** y aparecen en la cola
del administrador para revisión retroactiva.

---

## 2. Cómo probar cada flujo

Usa correos de prueba controlados. **No envíes invitaciones a pacientes reales.**

### Alta profesional
1. `/acceso` → «Soy profesional» → `/registro`.
2. Nombre, correo, contraseña → llega el correo de confirmación (lo manda el
   proveedor de autenticación que ya usaba la app, no Resend).
3. Abrir el enlace → vuelve a `/registro` → datos profesionales y **consulta
   individual o centro** → «Enviar solicitud».
4. Queda en `/registro/estado` con «en revisión». **Comprueba** que `/pro`
   rebota aquí y que no puede crear pacientes.

### Aprobación
1. Alta del administrador (una vez, ver §4).
2. `/admin` → cola de acreditaciones → «Aprobar».
3. El profesional recarga `/registro/estado` y ya entra a `/pro`.
   Rechazar exige motivo y retira el acceso.

### Invitación de profesional a un centro
1. Como propietario de un centro: `/pro/equipo` → correo + permisos.
2. El destinatario abre `/unirse/<token>`: ve el centro y el rol, **sin que se
   consuma el token**.
3. Acepta → se añade **una membresía al centro existente**. No se crea otro.
4. Comprueba que un administrador no puede invitar a nadie como `owner`.

### Invitación de paciente
1. Ficha del paciente → pestaña **«Acceso y equipo»** → correo → «Invitar a Terap».
2. La pantalla dice si el proveedor aceptó el correo, si falló o si no hay
   proveedor. En los dos últimos casos enseña el enlace para entregarlo a mano.
3. El paciente abre `/invitacion/<token>`: ve **qué centro** le invita y nada
   más. Abrirlo no consume nada.
4. Entra o crea cuenta → `/onboarding/<token>` → lee y acepta el
   consentimiento → queda vinculado.
5. Comprueba: aceptar con **otro correo** falla; reenviar **invalida** el enlace
   anterior; revocar lo mata al instante; a las 48 h caduca.

### Acceso clínico en un centro
1. Con dos profesionales en el mismo centro, comprueba que el segundo **no ve**
   los expedientes del primero.
2. Desde la ficha, «Dar acceso a un compañero» → ya lo ve.
3. `/pro/equipo` → «Retirar del equipo» → deja de verlo **inmediatamente**.

---

## 3. Migración de los datos existentes

**Nada se borra.** Ni tablas, ni expedientes, ni cuentas, ni vínculos.

```bash
# ANTES — solo lectura, no escribe nada
npm run informe:organizaciones

# (una persona aplica las migraciones en el remoto)

# DESPUÉS — comprueba que las relaciones se conservan
npm run informe:organizaciones -- --verificar
```

Qué hace el backfill, y por qué es inequívoco:

- Cada profesional pasa a tener **una consulta individual** de la que es
  propietario. Es la única lectura posible del modelo anterior: un profesional,
  sus pacientes, nadie más. **No se agrupa a nadie en centros.**
- Cada expediente hereda la organización de su profesional de referencia.
  `patients.professional_id` es `NOT NULL` y apunta a un único profesional, así
  que no hay ambigüedad.
- Cada profesional de referencia queda **asignado** a sus expedientes. Sin esto,
  el cambio de llave de acceso habría dejado a todos fuera de sus propios datos.
- Los profesionales existentes pasan a `provisional`: **conservan el acceso** y
  **no** se marcan como verificados.

Si algún expediente no pudiera derivar su organización, **la migración aborta**
con el recuento. No se asigna ninguno a ciegas.

El informe también señala dos residuos conocidos que la migración **no toca**:
cuentas con rol profesional sin ficha, y cuentas de paciente sin expediente
(el residuo de invitaciones abiertas con otro correo, documentado desde agosto).

---

## 4. Primer administrador de plataforma

`platform_admins` **nace vacía**. No tiene ni una política de RLS ni permiso de
API: no se puede llegar a ella desde la aplicación, y nadie puede autoasignarse
el rol. El alta se hace fuera de banda, una sola vez:

```bash
npm run admin:plataforma -- correo@dominio      # dar de alta
npm run admin:plataforma -- --listar            # ver quién lo es
npm run admin:plataforma -- --retirar correo@dominio
```

La cuenta debe existir ya (haber entrado alguna vez). **Hasta que se ejecute
esto, nadie puede aprobar acreditaciones ni conceder acceso beta**, así que los
registros nuevos se quedan en «pendiente».

Ser administrador de plataforma **no da acceso a ningún expediente**: no está
asignado a ninguno y la RLS se lo niega igual que a cualquiera.

---

## 5. Correo transaccional

Resend por API HTTP, sin dependencia npm nueva. Dos variables:

```
RESEND_API_KEY=
EMAIL_FROM="Terap <no-responder@tu-dominio>"
```

**Sin ellas no se envía nada y no se finge que sí.** La invitación se crea
igual, se registra en `email_deliveries` con estado `no_provider`, y la
interfaz enseña el enlace para entregarlo por otra vía.

Cuatro estados, y no se confunden: `pending` (creada), `sent` (**el proveedor lo
aceptó**, que no es acuse de lectura), `failed` (rechazado, con motivo) y
`no_provider`.

El correo lleva el nombre del centro, el botón «Activar mi acceso», la caducidad
y qué hacer si no lo esperaba. **No lleva** diagnósticos, etiquetas, tareas,
citas, el nombre del profesional ni nada del expediente.

---

## 6. Seguridad de las invitaciones

- Token de **256 bits** de `randomBytes`; en base de datos solo el **SHA-256**.
- **48 horas** por defecto, configurable por llamada (tope de 14 días).
- **Un solo uso**, y **abrir el enlace NO lo consume**: los antivirus de correo
  visitan las URL automáticamente. Se canjea al aceptar explícitamente.
- **Reemitir revoca** las anteriores que siguieran vivas.
- **Revocación** inmediata desde la ficha y desde `/pro/equipo`.
- **Límites**: 10 emisiones por expediente y hora; 20 por organización y hora.
- **Aceptación atómica** (`for update` sobre la invitación): dos pestañas a la
  vez no crean dos vínculos ni reutilizan el token.
- Al aceptar se **revalida todo otra vez** —organización, expediente, vigencia,
  destinatario—, no solo al emitir.
- Las URL salen de `NEXT_PUBLIC_SITE_URL`, **nunca de las cabeceras**
  (`x-forwarded-host` lo controla quien llama), y exigen HTTPS fuera de local.
- Las pantallas de aceptación llevan `referrer: no-referrer` y no cargan ni un
  script de analítica ni una fuente remota: el token va en el path.
- Los tokens **no aparecen** en registros, analítica ni mensajes de error.

`accept_invitation` **no está expuesta a la API**. El único camino de
vinculación es `complete_onboarding`, que antes obliga a mostrar el
consentimiento y comprueba que el texto firmado es el que se enseñó.

---

## 7. Acceso comercial

| Estado | Qué significa | Qué hace |
|---|---|---|
| `pending` | Sin beta concedida | **No bloquea nada.** Hoy no hay cobro |
| `beta` | Autorizado explícitamente | Registra quién, cuándo y hasta cuándo |
| `suspended` | Decisión manual | No borra nada. **No corta el acceso del paciente** |

No hay suspensiones automáticas, porque no hay impago que detectar. No se
publican precios, periodos de prueba ni límites: no están definidos.

---

## 8. Rollback

**Código.** Revertir el merge y desplegar. El esquema nuevo es compatible hacia
atrás para casi todo: las tablas nuevas quedan huérfanas pero no estorban, y
`patients.organization_id` es una columna añadida que el código anterior ignora.
Las dos excepciones, que hay que tener presentes:

- El código anterior llamaba a `issue_invitation(uuid, text)`, cuya firma
  cambió. Revertir solo el código deja el panel sin poder emitir invitaciones
  hasta que se restaure también esa función.
- Las políticas RLS pasan a exigir asignación. El código anterior sigue
  funcionando porque el backfill asigna a cada profesional sus expedientes.

**Datos.** El backfill **solo añade filas**; no modifica ni borra ninguna
existente salvo rellenar `patients.organization_id`, que antes no existía. Para
deshacerlo del todo:

```sql
-- En este orden. Nada de esto toca expedientes ni cuentas.
delete from public.patient_assignments;
delete from public.professional_invitations;
delete from public.organization_members;
delete from public.organization_access;
delete from public.organizations;
alter table public.patients drop column organization_id;
```

Y restaurar las funciones y políticas anteriores desde las migraciones
`20260909190001`–`20260911140001`.

**Copia de seguridad.** Ver §9.

---

## 9. Copia de seguridad sin plan de pago

Las copias **gestionadas** y el point-in-time recovery son funciones de pago.
Lo que NO depende del plan es hacerte tú un volcado. Por orden de preferencia:

### a) `supabase db dump` — lo mejor, y funciona en cualquier plan

Es `pg_dump` por debajo. Necesita la contraseña de la base (Dashboard →
Settings → Database; se puede regenerar), no un plan superior.

```bash
npx supabase link --project-ref levufuoigdlexscpvlgk
npx supabase db dump -f ../BACKUPS/pre-organizaciones.sql          # esquema
npx supabase db dump -f ../BACKUPS/pre-organizaciones-datos.sql --data-only
```

Trae **todo**: esquema, datos, funciones, políticas y —lo que ninguna otra vía
da— las contraseñas de `auth.users`.

### b) `npm run copia:datos` — la red cuando (a) no es posible

Lee todas las tablas con `service_role` por la API y las escribe a disco con
recuentos y SHA-256. No necesita contraseña de base de datos ni plan.

```bash
npm run copia:datos
npm run copia:datos -- --verificar ../BACKUPS/DATOS-<sello>
```

**Qué no cubre, y hay que saberlo:** las contraseñas de `auth.users` (la Admin
API no las expone: al restaurar, la gente vuelve a entrar por enlace mágico o
restableciendo contraseña), el contenido binario de Storage (guarda el
inventario, no los bytes) y el esquema (se reconstruye ejecutando las
migraciones, que son la fuente de verdad).

### c) Qué riesgo queda de verdad

Estas cuatro migraciones **no borran ningún dato**. Auditado línea a línea: cero
`DELETE`, cero `DROP TABLE`, cero `DROP COLUMN`, cero `TRUNCATE`. Las únicas
cuatro escrituras de datos son:

| Operación | Qué toca |
|---|---|
| `update professionals` | Rellena `verification_status`, columna **nueva** |
| `update patients` | Rellena `organization_id`, columna **nueva** |
| `update invitations` | Rellena `organization_id`, columna **nueva** |
| `insert` ×4 | Filas en tablas **nuevas** |

Ninguna modifica una columna que ya tuviera datos. Todo lo que se elimina son
objetos de esquema —políticas, disparadores, un índice, una restricción y dos
funciones—, y todos se reconstruyen desde los propios ficheros de migración.

Además, **cada migración va dentro de `begin; … commit;`**: o entra entera o no
entra nada. No existe el estado intermedio a medio aplicar.

Eso no convierte la copia en opcional —un error humano posterior sigue siendo
posible— pero sí acota el riesgo: lo que hay que poder recuperar es el estado
de los datos, no una corrupción del esquema.

## 10. Orden de despliegue

1. Copia de seguridad de la base remota (§9). **Verificada, no solo lanzada.**
2. `npm run informe:organizaciones` y leer la salida.
3. Variables en Vercel: `RESEND_API_KEY`, `EMAIL_FROM`, y comprobar que
   `NEXT_PUBLIC_SITE_URL` apunta al dominio con HTTPS.
4. Aplicar las migraciones `20260916100001`–`20260916100004` **en ese orden**
   (lo hace una persona: el agente no toca el remoto).
5. `npm run informe:organizaciones -- --verificar`.
6. Mergear el PR → Vercel despliega.
7. `npm run admin:plataforma -- <correo>` para el primer administrador.
8. Revisar en `/admin` la cola: los profesionales existentes salen como
   `provisional` y conviene revisarlos.

El paso 4 va **antes** del 6: el código nuevo sobre el esquema viejo rompe
producción.
