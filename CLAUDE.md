# terap.ia

App de **bienestar mental para psicólogos de consulta privada** y sus pacientes.
Producto completo (no MVP). La app del paciente se distribuirá como PWA y, más
adelante, como apps nativas iOS/Android envueltas con Capacitor.

> El plan de sesiones vive en
> `../01. DOCUMENTACION/PLAN_APP_sesiones_claude_code_v2.md`.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4** (config CSS-based,
  sin `tailwind.config.js`).
- **Supabase** (EU-Frankfurt): Auth, Postgres, RLS, Storage, Edge Functions.
- **Vercel** para el despliegue.
- App paciente: **PWA** (Capacitor en la Sesión 10).

> Nota Next.js 16: el "middleware" se llama ahora **`proxy`** (`src/proxy.ts`) y
> corre en runtime Node.js. `cookies()` es **asíncrono**. Consulta las guías en
> `node_modules/next/dist/docs/` antes de usar APIs de Next (hay breaking changes).

## Decisiones de alcance (v2) — vinculantes

- **Escalas PHQ-9/GAD-7 OPT-IN:** desactivadas por defecto. El profesional las
  activa por paciente (puntual o recurrente). Sin activación, el paciente no ve
  ninguna escala.
- **Pagos: seguimiento SÍ, facturación NO.** Precios, registro de pagos, bonos,
  deuda y export CSV. La app **nunca emite facturas** (evita Veri*factu).
- **Diario emocional incluido:** registro de ánimo del paciente, visible por su
  profesional. **Sin interpretación ni recomendaciones** (evita reclasificación
  como producto sanitario, MDR).
- **Solo datos ficticios** hasta que existan DPA + base jurídica RGPD art. 9 +
  decisión explícita. Banner permanente de demo siempre visible.
- **Nada que interprete o recomiende clínicamente. Nada que emita facturas.**
- Fuera de alcance por ahora: videoconsulta integrada (solo un campo "link de
  videollamada" en la cita), mensajería profesional-paciente (fase 2).

## Arquitectura de autenticación y roles

- Dos áreas: **`/pro`** (panel profesional) y **`/app`** (paciente).
- Auth vía `@supabase/ssr` con **dos métodos**: email + **contraseña**
  (`signInWithPassword`, solo cuentas existentes) y email + **magic link**
  (crea la cuenta y fija el rol en el primer acceso). Recuperación/creación de
  contraseña: `resetPasswordForEmail` → `/auth/confirm` → **`/account/password`**
  (`updateUser({ password })`; enlazada desde Ajustes de ambas áreas).
  Pendiente: wizard de registro solo para psicólogos (sustituirá al primer
  acceso por enlace mágico del profesional).
- Clientes Supabase centralizados:
  - `src/lib/supabase/client.ts` — browser (`createBrowserClient`).
  - `src/lib/supabase/server.ts` — server components / route handlers (async `cookies()`).
- `src/proxy.ts` — refresca la sesión en cada request + redirección **optimista**
  por rol. **No es la capa de autorización definitiva.**
- **Autorización definitiva:** cada layout server (`/pro/layout.tsx`,
  `/app/layout.tsx`) revalida `supabase.auth.getUser()` y el rol. Defensa en
  profundidad (recomendación de Next.js y Supabase).
- **Rol:** resuelto SIEMPRE por `src/lib/auth/roles.ts` (`getUserRole`), que lee
  **solo `app_metadata`** (ago 2026, migración `20260807120001`).
  - `app_metadata` únicamente lo escribe el servidor: el trigger
    `handle_new_user` (SECURITY DEFINER) o alguien con `service_role`.
  - **Nunca volver a leer `user_metadata`:** es de escritura libre para el
    propio usuario (`supabase.auth.updateUser({ data: { role } })`), así que
    cualquier paciente podía ascenderse a profesional.

### Alta de un profesional (ya NO es autoservicio)

Desde ago 2026 `/login` no crea cuentas (`shouldCreateUser` solo se activa en el
alta por invitación) y la política `professionals_insert_self` está eliminada.
Para dar de alta a un psicólogo, con la `service_role`:

```js
await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { full_name: "Nombre Apellido" },
  app_metadata: { role: "professional" },   // ← esto es lo que da el rol
});
```

El trigger `handle_new_user` crea la fila en `professionals` y su plantilla de
consentimiento por defecto. Sin `app_metadata.role`, el usuario se crea como
`patient` (el rol sin privilegios). El wizard de registro para psicólogos
sustituirá este paso manual.

## Estructura

```
src/
  proxy.ts                      # Next 16 "middleware": sesión + redirección por rol
  app/
    layout.tsx                  # idioma es, banner de demo permanente
    page.tsx                    # landing → /login
    login/page.tsx              # magic link + selección de rol (solo 1er acceso)
    auth/confirm/route.ts       # verifica enlace (code o token_hash) → home por rol
    auth/signout/route.ts       # POST → signOut → /login
    pro/{layout,page}.tsx       # panel profesional (guard: professional)
    app/{layout,page}.tsx       # app paciente (guard: patient) + botón emergencia
  components/SignOutForm.tsx
  lib/
    auth/roles.ts               # ROLES, getUserRole, homePathForRole
    supabase/{client,server}.ts
```

## Convenciones

- **Migraciones SQL** siempre en `supabase/migrations/` y en el repo. Nunca
  cambios manuales en la BD sin migración.
- **Commit por bloque funcional.** Al cerrar cada sesión: commit + push +
  actualizar la sección **Estado** de este archivo.
- Tipos de Supabase se generarán con `supabase gen types` (Sesión 1).
- Calidad: `npm run lint` (ESLint 9 flat config) y `npm run typecheck`
  (`tsc --noEmit`). CI en `.github/workflows/ci.yml`.
- Idioma de UI y comunicación: **español**. Código y comentarios técnicos, según
  convención del archivo.
- **Secretos:** `.env.local` y `.env*` fuera del repo (solo `.env.example` se
  versiona).

## Configuración local

1. `cp .env.example .env.local` y rellenar `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores del proyecto Supabase (EU).
2. `npm install` && `npm run dev`.
3. En Supabase → Authentication → URL Configuration: añadir
   `http://localhost:3000/auth/confirm` (y la URL de producción) a las Redirect
   URLs. Si la plantilla de email usa `token_hash`, apuntarla a
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

---

## Estado

### Sesión 0 — Scaffold ✅ (completada)

**Hecho:**
- Scaffold Next.js 16 + TypeScript + Tailwind v4 (App Router, `src/`, alias `@/*`).
- Repositorio git **dedicado dentro de `PROYECTO/`** (aislado del repo de la home
  del usuario). Push: pendiente de remoto (se hizo commit local; `gh` no
  instalado).
- Estructura de rutas `/pro` (profesional) y `/app` (paciente) con placeholders.
- Supabase Auth por email + magic link (`@supabase/ssr`): clientes browser/server,
  ruta `/auth/confirm`, `/auth/signout`, login con selección de rol.
- `src/proxy.ts`: refresco de sesión + redirección por rol; layouts server
  revalidan usuario y rol (defensa en profundidad).
- `.gitignore` protege `.env*` (versiona solo `.env.example`).
- Calidad mínima: scripts `lint` + `typecheck` y workflow de CI.
- Banner de demo permanente y botón de emergencia (024) en el área de paciente.

**Decisiones tomadas:**
- Middleware = `proxy.ts` (Next 16). Rol en metadata como bootstrap; migrará a
  `profiles` en Sesión 1 (único punto a cambiar: `getUserRole`).
- Push del repo: **commit local sin push** (a elección del usuario; sin remoto aún).
- Clave pública Supabase en formato nuevo `sb_publishable_...` (sustituye a la
  anon JWT); va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Pendiente / al empezar la Sesión 1:**
- `.env.local` ya tiene las credenciales reales de Supabase (EU) y están
  **validadas** (endpoint settings → 200, email auth activo). Falta la prueba
  interactiva del enlace mágico (requiere abrir el email) y comprobar en Supabase
  que las Redirect URLs permiten `http://localhost:3000/**`.
- Configurar un remoto git y hacer push cuando se decida.
- Sesión 1: modelo de datos completo + RLS + `supabase gen types` (mover el rol a
  `profiles`).

### Sesión 1 — Modelo de datos completo + RLS ✅ (completada)

**Hecho:**
- **9 migraciones** en `supabase/migrations/` (`…001`–`…009`), **aplicadas** al
  proyecto remoto (`supabase db push`).
- **19 tablas**, todas con RLS: professionals, patients, invitations, tasks,
  task_completions, scales, scale_assignments, scale_responses, appointments,
  payment_settings, session_packs, payments, mood_entries, resources, documents,
  consent_templates, consents, emergency_links, notifications.
- Helpers `SECURITY DEFINER` para RLS sin recursión: `current_professional_id()`,
  `current_patient_id()`, `current_patient_professional_id()`,
  `professional_owns_patient()`.
- Glue de auth: trigger `handle_new_user` (crea `professionals` al registrarse) y
  función `accept_invitation` (token de un solo uso + caducidad).
- Escalas **opt-in**: sin `scale_assignments` activo el paciente no ve ni puede
  responder. Seed catálogo **PHQ-9** y **GAD-7** (v1).
- Trigger `compute_scale_response`: score + severidad (rangos estándar) + flag de
  ítem crítico (PHQ-9 ítem 9). Solo calcula/clasifica, no interpreta.
- Pagos **sin facturación** (céntimos). Seed emergencias **024/112**.
- Tipos generados en `src/lib/database.types.ts` (`npm run gen:types`) y
  conectados a los clientes Supabase (`createBrowserClient<Database>`, etc.).
- **Test de RLS** `scripts/test-rls.mjs` (`npm run test:rls`): **24/24 OK** —
  aislamiento profesional↔profesional y paciente↔paciente, escritura cruzada
  bloqueada, opt-in y scoring.
- `supabase` CLI fijado como devDependency; `config.toml` vía `supabase init`.

**Decisiones / notas:**
- **No se creó tabla `profiles`**: el ámbito se deriva de pertenecer a
  `professionals`/`patients`; el rol operativo lo sigue leyendo la app del
  metadata (Sesión 0) vía `getUserRole`. Migrar el origen del rol a BD queda para
  cuando haga falta (solo cambiaría `getUserRole`).
- Se añadió `consent_templates` (plantilla) separada de `consents` (firma).
- La migración `…009` endurece el `with check` de escritura del profesional
  (exige `professional_owns_patient`) tras detectar el test un hueco; + trigger
  `patients_guard` (el paciente no puede reasignarse de profesional ni archivarse).
- Simplificación pendiente (Sesiones 2/5): control por columnas en el
  `UPDATE` del paciente sobre su ficha/citas.

**Pendiente / al empezar la Sesión 2:**
- `SUPABASE_SERVICE_ROLE_KEY` está en `.env.local` (solo para `test:rls`; nunca al
  repo/cliente).
- Panel profesional: lista y ficha de pacientes, invitaciones, tareas (Sesión 2).

### Sesión 2 — Panel profesional: gestión de pacientes ✅ (completada)

**Hecho:**
- Migraciones `…010` (`patient_notes` + RLS) y `…011` (`invitation_preview`,
  función SECURITY DEFINER para la landing pública de invitación).
- **Capa de queries** centralizada en `src/lib/queries/` (identity, patients con
  resumen, tasks, notes, invitations, patient-detail) — nunca lookups sueltos.
- **Server actions** en `src/lib/actions/` (patients: crear/estado/etiquetas,
  tasks CRUD, notes, invitations) con `revalidatePath`.
- **Dashboard `/pro`**: lista de pacientes con resumen (tareas pendientes, próxima
  cita, última actividad, alertas), filtros por estado (activo/archivado/todos) y
  por etiqueta, alta de paciente.
- **Ficha `/pro/patients/[id]`**: cabecera (estado, etiquetas editables,
  archivar/reactivar), pestañas — **Tareas** (CRUD completo) y **Notas** (CRUD)
  funcionales; Escalas/Citas/Pagos/Diario/Documentos en solo-lectura con datos
  reales (gestión completa en sus sesiones).
- **Invitación por link** (token de un solo uso) generable desde la ficha +
  landing pública `/invite/[token]` (valida vía `invitation_preview`).
- Tipos conectados a los clientes Supabase (`createBrowserClient<Database>`).
- Verificación: `build` + `lint` + `typecheck` OK; **`npm run test:pro`** (flujo
  profesional real contra Supabase) **16/16**; `test:rls` sigue 24/24.

**Decisiones / notas:**
- `patient_notes`: notas privadas del profesional (el paciente no tiene acceso).
- Tabs por query param (`?tab=`), server-rendered (sin JS para navegar).
- El `patients_guard` permite al profesional dueño archivar/reactivar (cambiar
  `status`); histórico intacto.
- El proxy hace pública la ruta `/invite`.

**Pendiente / al empezar la Sesión 3:**
- La UI del panel necesita probarse en navegador con un profesional logueado
  (login por magic link, no automatizable); la lógica de datos está verificada
  por `test:pro`.
- Sesión 3: PWA del paciente — alta por invitación (consumir token vía
  `accept_invitation`), home, completar tareas, botón de emergencia.

### Sesión 3 — PWA paciente base ✅ (completada)

**Hecho:**
- **Alta por invitación**: `/invite/[token]` → `/login?invite=<token>` (fuerza rol
  paciente) → magic link → `/auth/confirm?next=/onboarding/<token>` →
  `/onboarding/[token]`. La acción `completeOnboardingAction` consume el token
  (`accept_invitation`, un solo uso) y **registra la firma del consentimiento**
  (checkbox + timestamp + hash SHA-256 del texto) en `consents`.
- Login refactorizado: `page.tsx` (server, lee `?invite`) + `LoginForm.tsx`
  (client).
- **Home `/app`**: saludo, próxima cita (con link de videollamada si existe) y
  tareas; el paciente **completa tareas** (marcar hecha + texto libre opcional).
  Botón de emergencia (024) siempre visible en el layout. Estado "no vinculado"
  gestionado.
- **PWA**: `app/manifest.ts` (standalone, theme calmado `#4f9d8b`, `start_url`
  `/app`), iconos PNG generados sin dependencias (`npm run gen:icons`),
  `public/sw.js` (con handler de fetch → instalable) registrado desde el layout,
  `viewport`/`themeColor`/`appleWebApp` en metadata. Proxy excluye
  `manifest.webmanifest` y `sw.js`.
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:onboarding`**
  (alta real contra Supabase: aceptar invitación → vincular → consentimiento →
  completar tarea → token de un solo uso) **8/8**. `test:rls` 24/24, `test:pro`
  16/16.

**Decisiones / notas:**
- Consentimiento: se firma un texto por defecto (`src/lib/consent.ts`); la gestión
  de plantillas propias del profesional se hará más adelante (`template_id` null).
- `accept_invitation` es ejecutable por el paciente (verificado); vincula
  `patients.user_id` sin tocar `professional_id`/`status` (respeta `patients_guard`).
- Onboarding devuelve resultado (sin `redirect()` en la action) para poder mostrar
  errores en el cliente.

**Pendiente / al empezar la Sesión 4:**
- Probar en navegador/móvil el ciclo completo con login por magic link (alta →
  consentimiento → completar tarea → instalar PWA); la lógica está verificada por
  `test:onboarding`.
- Sesión 4: escalas clínicas opt-in (activación por el profesional, formulario en
  la PWA, puntuación + severidad, alerta ítem 9, gráfica + export).

### Sesión 4 — Escalas clínicas (opt-in) ✅ (completada)

**Hecho:**
- **Activación por el profesional** (ficha, pestaña Escalas): `ScalesPanel` activa
  PHQ-9/GAD-7 (puntual o recurrente con intervalo), activa/desactiva sin borrar
  histórico. Sin activación el paciente no ve nada (reforzado por RLS).
- **Formulario en la PWA** (`/app/scales/[assignmentId]`): el paciente ve solo sus
  escalas activas (sección "Cuestionarios" en el home), responde con validación.
- **Puntuación + severidad** por el trigger de BD; se muestran al **profesional**
  (no se muestra interpretación al paciente, solo confirmación).
- **Alerta ítem 9 PHQ-9 (>0)**: al paciente, pantalla inmediata con **recursos de
  emergencia** (024/112 + los del profesional); al profesional, banner destacado
  en el dashboard y en la ficha.
- **Evolución** (`/pro/patients/[id]/scales/[assignmentId]`): gráfica SVG de una
  serie (`ScoreChart`, tema-aware, bandas de severidad como referencia neutra) +
  tabla de respuestas + **export CSV** (route handler con BOM).
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:scales` 12/12**
  (activar → responder → puntuar/severidad → alerta ítem 9 → desactivar bloquea).
  `test:rls` 24/24, `test:pro` 16/16, `test:onboarding` 8/8.

**Decisiones / notas:**
- No se creó migración (el esquema de escalas ya estaba completo desde Sesión 1).
- **Al paciente no se le muestra su severidad/puntuación** (evita autointerpretación
  sin guía); sí ve recursos de emergencia si marca el ítem de riesgo. El profesional
  ve puntuación/severidad/gráfica/CSV. Nada interpreta ni recomienda clínicamente.
- Gráfica hecha con la skill dataviz: serie única (sin leyenda), tabla acompañante,
  tooltips nativos `<title>`; color de serie fijo `#3b82f6`.

**Pendiente / al empezar la Sesión 5:**
- Probar en navegador el ciclo visual (activar → responder en PWA → gráfica/alerta);
  la lógica está verificada por `test:scales`.
- Sesión 5: agenda y citas (CRM) — calendario, recurrencia, .ics, asistencia.

### Sesión 5 — Agenda y citas (CRM) ✅ (completada)

**Hecho:**
- Migración `…013` (`agenda_blocks` para bloqueos/vacaciones, RLS solo profesional).
- **Agenda del profesional** (`/pro/agenda`, con nav en el layout): crear cita
  (con selector de paciente, link de videollamada, **recurrencia** puntual/
  semanal/quincenal/mensual con fecha fin, cap 26), editar, cancelar, eliminar;
  **registro de asistencia** (acudió/no acudió/canceló tarde → status completada);
  bloqueos (crear/eliminar); vista por día.
- **Al crear cita → notificación** encolada al paciente (tabla `notifications`) +
  **archivo `.ics`** descargable (`/appointments/[id]/ics`, RLS: profesional o
  paciente).
- **Paciente** (`/app/appointments`, link desde el home): ver próximas/anteriores,
  **confirmar/cancelar**, descargar `.ics`, abrir videollamada.
- Ficha Citas: enlace "Nueva cita en la agenda" (prefill paciente) + `.ics`.
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:agenda` 12/12**
  (crear → ver/confirmar/cancelar → asistencia → notificación → bloqueo privado →
  aislamiento). test:rls 24/24, test:pro 16/16, test:onboarding 8/8, test:scales 12/12.

**Decisiones / notas:**
- Fechas: el cliente convierte `datetime-local` (hora local) → ISO/UTC antes de
  enviar (el servidor no debe interpretar la zona). `.ics` en UTC (`...Z`).
- Recurrencia: se generan N filas con `parent_appointment_id` (no expansión
  virtual); tope 26 ocurrencias.
- Paciente puede `UPDATE` sus citas (confirmar/cancelar) por RLS; control por
  columnas queda pendiente (server actions ya limitan la UI).
- `next` de `datetime-local` y "ahora" se calculan fuera del render (regla de
  pureza de React): split de citas en la capa de queries.

**Pendiente / al empezar la Sesión 6:**
- Probar en navegador el ciclo cita↔paciente y abrir el `.ics` en Google/Apple
  Calendar; la lógica está verificada por `test:agenda`.
- Sesión 6: seguimiento de pagos (precios, pagos, bonos, deuda, export) SIN
  facturación.

### Sesión 6 — Seguimiento de pagos (sin facturación) ✅ (completada)

**Hecho:**
- Sin migración (esquema de pagos ya existía). Importes en **céntimos**.
- **Ficha, pestaña Pagos** (`PaymentsPanel`): precio por sesión (upsert
  `payment_settings`), bonos 5/10 con precio, registro de pagos
  (pagado/pendiente, alternar estado, eliminar), deuda + bono restante.
- **Consumo automático de bono**: al marcar una cita como "acudió"
  (`setAttendanceAction` → `settleAttendedAppointment`): si hay bono activo con
  sesiones, consume una (`used_sessions++`) y registra un pago cubierto; si no,
  crea un **pago pendiente** con el precio aplicable (paciente o por defecto).
  Idempotente (no re-liquida una cita ya liquidada).
- **`/pro/pagos`**: resumen de ingresos por mes + cobrado/pendiente totales +
  **export CSV** para gestoría (`/pro/pagos/export`, con BOM).
- **Paciente** (`/app/payments` + card en el home): pendiente de pago + bono
  restante + lista de pendientes (solo lectura).
- **Prohibido facturar**: no hay generación de facturas en código ni UI; el CSV
  es un export para la gestoría, no una factura (avisos en la UI).
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:payments` 10/10**
  (precio upsert, bono con consumo, pendiente→pagado, deuda del paciente,
  aislamiento). Resto de tests siguen verdes.

**Decisiones / notas:**
- El auto-consumo vive en `src/lib/payments.ts` (`settleAttendedAppointment`),
  llamado desde la action de asistencia; se ejercita por la UI de agenda (el test
  cubre las operaciones de pago/bono y la RLS).
- `session_type` por defecto `individual` (no hay tipos por cita en el esquema).

**Pendiente / al empezar la Sesión 7:**
- Probar en navegador el ciclo cita→asistencia→pago/bono→resumen→export.
- Sesión 7: diario emocional (paciente) + biblioteca de recursos + documentos.

### Sesión 7 — Diario emocional + biblioteca + documentos ✅ (completada)

**Hecho:**
- Migración `…014`: bucket privado de Storage **`files`** + políticas RLS
  (ruta `<patientId>/<archivo>`; el profesional dueño sube/lee/borra, el paciente
  lee).
- **Diario emocional**: el paciente registra ánimo 1-5 + nota (`MoodLogger` en
  `/app` y `/app/diary`), ve su histórico y gráfica. El profesional lo ve en la
  ficha (pestaña Diario) con **gráfica** (reutiliza `ScoreChart`, max 5, sin
  bandas). **Sin análisis ni sugerencias.**
- **Biblioteca de recursos** (ficha, pestaña Recursos, `ResourcesPanel`): el
  profesional comparte **enlaces** (por paciente o generales para todos sus
  pacientes) y **sube archivos** PDF/audio (Storage, por paciente); borrar. El
  paciente los ve en `/app/resources`.
- **Documentos** (ficha, pestaña Documentos, `DocumentsPanel`): subir/listar/
  borrar por paciente (Storage). Descarga por **URL firmada** vía ruta `/files`
  (la RLS de Storage autoriza; `createSignedUrl` solo funciona si hay permiso).
- Paciente: cards/enlaces en el home a Diario y Recursos.
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:wellbeing` 10/10**
  (diario RLS, recursos por paciente/generales, **Storage con RLS**: subida del
  profesional, URL firmada del paciente, aislamiento). Resto de tests verdes.

**Decisiones / notas:**
- Storage por paciente (`<patientId>/…`); recursos-archivo son por paciente; los
  recursos "generales" (a todos) son solo enlaces.
- Descarga vía route handler `/files?path=` que hace `createSignedUrl` con la
  sesión del usuario (RLS de Storage decide).
- Subidas mediante server actions con `FormData` (el archivo se sube con la sesión
  del profesional; RLS aplica).

**Pendiente / al empezar la Sesión 8:**
- Probar en navegador la subida/descarga real de archivos y el diario.
- Sesión 8: notificaciones y recordatorios (Web Push VAPID + Edge Functions/cron).

### Sesión 8 — Notificaciones y recordatorios ✅ (completada)

**Hecho:**
- Migración `…015`: `push_subscriptions` + `notification_preferences` (RLS: cada
  usuario lo suyo).
- **Web Push (VAPID)**: `web-push` (dep), claves VAPID en `.env.local`
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` pública; `VAPID_PRIVATE_KEY` privada). Service
  worker con handlers `push` + `notificationclick` (abre la app en la URL).
- **Suscripción y preferencias**: `PushToggle` (suscribir/desuscribir el
  dispositivo) + `NotificationPreferences` (qué recibir); páginas `/app/settings`
  y `/pro/ajustes` (+ enlaces en nav/header).
- **Encolado por evento**: al crear cita (Sesión 5), tarea o escala se inserta una
  notificación `queued` para el paciente.
- **Envío programado**: route handler **`/api/cron/notifications`** (Node,
  service_role, protegido por `CRON_SECRET`): genera **recordatorios de cita en la
  ventana 24-48 h** (idempotente por `payload.appointment_id`) y **envía** las
  encoladas por Web Push, **filtrando por preferencias**; limpia suscripciones
  caducadas (404/410). Programado con **Vercel Cron** (`vercel.json`, horario).
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:notifications`
  9/9** (RLS de suscripciones/preferencias + encolado/lectura); **smoke del cron**
  (401 sin secreto; 200 con resumen JSON, pipeline completo sin errores). Resto
  de tests verdes.

**Decisiones / notas:**
- Se implementó el envío con **Vercel Cron + route handler** (Next/Vercel) en vez
  de Edge Functions Deno: misma finalidad, más verificable en este stack.
- Filtrado por preferencias en el envío (no en el encolado): el profesional no
  puede leer las preferencias del paciente (RLS), así que decide el cron.
- **Fallback email**: preferencia modelada; el envío por email queda pendiente de
  proveedor (Resend/SMTP) — hoy, sin push, la notificación se marca `failed`.
- La **entrega real a un dispositivo** requiere navegador (suscripción push) +
  despliegue con `CRON_SECRET`/VAPID en el entorno.
- **Vercel Hobby solo permite cron DIARIO.** `vercel.json` usa `0 8 * * *` (una
  vez/día, 08:00 UTC); una expresión horaria (`0 * * * *`) hace **fallar el
  deploy** en Hobby. Es correcto: la ventana de recordatorio 24-48 h da ventanas
  diarias contiguas → cada cita recibe 1 recordatorio (idempotente por
  `appointment_id`). Con plan Pro puede volver a ponerse horario.

**Pendiente / al empezar la Sesión 9:**
- Probar en navegador: activar push, recibir un recordatorio/tarea.
- Configurar en Vercel las envs (VAPID, CRON_SECRET, SERVICE_ROLE) para el cron.
- Sesión 9: analítica de consulta (ocupación, no-shows, ingresos, activos vs
  archivados; evolución agregada de escalas).

### Sesión 9 — Analítica de consulta ✅ (completada)

**Hecho:**
- Sin migración (agrega datos ya existentes). Query `getProfessionalAnalytics`
  (`src/lib/queries/analytics.ts`).
- **`/pro/analitica`** (nav): tiles (pacientes activos/archivados, **tasa de
  no-shows**, citas de las últimas 8 semanas), **ocupación semanal** (BarChart),
  **ingresos por mes** (BarChart, reutiliza `getPaymentsOverview`) y **evolución
  agregada de escalas** (media mensual por escala, `ScoreChart`) — anónima.
- Componente `BarChart` (SVG, una serie, tema-aware).
- Todo **descriptivo y anonimizado**; sin interpretación clínica.
- Verificación: `build`/`lint`/`typecheck` OK; **`npm run test:analytics` 6/6**
  (activos/archivados, no-shows 33%, ocupación 8 sem., ingresos, respuestas de
  escala visibles al profesional). Resto de tests verdes.

**Notas:**
- Con la BD sin seed, el panel muestra estados vacíos ("se poblará con el seed");
  la historia coherente llega con la **Sesión 11** (seed).

**Pendiente / al empezar la Sesión 10:**
- Sesión 10: apps nativas (Capacitor) — envolver la PWA, push nativo, biometría,
  checklist de publicación.

### Sesión 10 — Apps nativas (Capacitor) 🟡 (código listo; build en dispositivo pendiente de toolchains)

**Hecho:**
- Migración `…016`: `device_push_tokens` (FCM/APNs) + RLS por usuario.
- **Capacitor 8** instalado (`core/cli/android/ios/app/push-notifications` +
  `@aparajita/capacitor-biometric-auth` + `@capacitor/assets`). `capacitor.config.ts`
  (`appId com.terapia.app`, `webDir www`, `server.url` desde `CAP_SERVER_URL`:
  la app nativa carga la **PWA desplegada**). `www/index.html` placeholder.
- **Integración web** (solo actúa en nativo, imports dinámicos tras
  `Capacitor.isNativePlatform()`, la PWA web no se ve afectada): `src/lib/native.ts`
  (biometría + push nativo), `NativeGate` en el layout `/app` (desbloqueo
  biométrico al abrir + registro de push nativo), acción `saveNativePushTokenAction`.
- Scripts `cap:*` (add/sync/open/assets) y **checklist de publicación**
  (`docs/PUBLICACION_STORES.md`): FCM/APNs, `NSFaceIDUsageDescription`, privacidad
  de datos de salud en App Store/Play Store.
- `.gitignore`: `/android` y `/ios` (proyectos nativos se generan con `cap add`).
- Verificación: `build`/`lint`/`typecheck` **web** OK.

**Límite del entorno (honesto):**
- Este entorno es **Windows sin Xcode ni Android SDK**: el **build instalable en
  dispositivo/simulador** (el cierre de la sesión) **no se pudo ejecutar aquí**.
  Los proyectos `android/`/`ios/` y el build se generan en una máquina con las
  toolchains siguiendo `docs/PUBLICACION_STORES.md`.
- Envío de push **nativo** (FCM Admin) queda pendiente de credenciales FCM; el web
  push sí funciona. `device_push_tokens` reutiliza el patrón RLS ya verificado.

**Pendiente / al empezar la Sesión 11:**
- Generar/compilar nativo en macOS (iOS) y con Android SDK; probar biometría+push.
- Sesión 11: seed idempotente (2 profesionales, 8-10 pacientes, 3 meses de
  histórico) + deploy Vercel + landing + guion de demo + Lighthouse.

### Sesión 11 — Seed + deploy + pulido ✅ (completada; deploy/Lighthouse documentados)

**Hecho:**
- **Seed idempotente** (`scripts/seed.mjs`, `npm run seed`) **ejecutado y
  verificado** en el remoto: 2 profesionales, **10 pacientes**, ~3 meses de
  histórico → **130 citas** (con asistencia/no-shows), **76 pagos pagados + 20
  pendientes**, 3 bonos, **66 respuestas** de escala (**1 con alerta ítem 9**:
  paciente "Ana Nadal"), **261 entradas de diario**, tareas. Re-ejecutar no
  duplica (omite si el profesional ya tiene pacientes).
  - Parametrizable: `SEED_PRO_EMAIL=tu-correo npm run seed` para entrar por enlace
    mágico y ver la consulta.
- **Landing** `/` pulida (propuesta de valor + CTA "Acceder"). Banner permanente
  de demo ya presente desde Sesión 0.
- **Docs**: `docs/GUION_DEMO.md` (guion de 7-8 min: alta → tarea → cita .ics →
  escala opt-in → alerta ítem 9 → diario → pagos → analítica) y `docs/DEPLOY.md`
  (Vercel + variables de entorno + Redirect URLs + cron + Lighthouse).
- Verificación: `build`/`lint`/`typecheck` OK; seed verificado por conteos vía
  Management API.

**Límite del entorno (honesto):**
- **Deploy a Vercel y Lighthouse no se ejecutaron aquí** (sin token de Vercel ni
  Chrome). Pasos exactos en `docs/DEPLOY.md`. La URL pública del cierre se obtiene
  al desplegar con esos pasos.

### Módulo Contabilidad (agregador fiscal + exports) ✅ (aplicado y verificado; deploy Vercel vía git)

Solicitado como "S6 — Contabilidad". Permite al psicólogo autónomo **registrar
gastos deducibles, ver estimaciones fiscales ORIENTATIVAS y exportar los libros
registro para la gestoría**. **NUNCA emite facturas** (decisión de producto para
quedar fuera de Verifactu / Ley Antifraude), no envía a la AEAT, sin OCR.

**Hecho:**
- Migración `20260721090001_contabilidad.sql`: tablas `configuracion_fiscal`,
  `gastos`, `bienes_inversion` (todas con RLS `professional_id =
  current_professional_id()`, idéntico al resto) + vista `v_ingresos_fiscales`
  (deriva de `payments`, **`security_invoker = true`** para heredar la RLS; solo
  ingresos `status='paid'`) + bucket privado de Storage **`receipts`** (ruta
  `<professionalId>/<archivo>`, políticas por profesional).
- **Motor fiscal** en `src/lib/fiscal/`: `parametros/{2026,index}.ts` (valores
  aislados por ejercicio), `modelo130.ts`, `resumenAnual.ts` (4 pagos
  fraccionados encadenados), `libros.ts` (libros registro), `calendario.ts`
  (vencimientos/alertas), `helpers.ts`, `types.ts`. Funciones **puras** (reciben
  "hoy"), trabajan en **euros** y redondean a céntimo. Math validada con `tsx`.
- **UI bajo `/pro/contabilidad`** (dashboard con estimación 130 del trimestre +
  vencimientos + descargo; `/gastos` alta/edición con justificante a Storage y
  bienes de inversión; `/configuracion`; `/exportar`). Entrada en `ProNav`
  (icono `Calculator`). Descargo **visible y no descartable** en todo output.
- **Exports** en `/pro/contabilidad/export` (`?formato=xlsx|pdf|csv&ejercicio=&periodo=anual|1..4`):
  **XLSX** (SheetJS) con 3 hojas de libros + hoja resumen; **PDF** (pdf-lib)
  resumen legible; **CSV** (`;`, decimales con coma, BOM). Deps añadidas:
  `xlsx` (0.18.5, uso **solo de escritura** desde datos propios → los advisories
  de su parser no aplican) y `pdf-lib`.
- Seed ampliado (`scripts/seed.mjs`): `configuracion_fiscal` + ~14 gastos + 1–2
  bienes por profesional (datos ficticios). **Idempotente por su cuenta** (se
  siembra aunque los pacientes ya existieran de una ejecución previa).
- **Aplicado y verificado en el remoto:** `supabase db push` (migración
  `20260721090001` aplicada), `npm run gen:types` (tipos regenerados canónicos),
  `npm run seed` (14 gastos + bienes por profesional), **`npm run test:contabilidad`
  14/14** (aislamiento en las 3 tablas + vista con RLS heredada por
  `security_invoker` + solo-cobrados). `build` + `typecheck` + `lint` OK.

**Adaptaciones al schema/convenciones reales (prevalecen sobre el spec):**
- `professional_id → professionals(id)` + `current_professional_id()` (el spec
  usaba `auth.users`); **dinero en céntimos int** y **porcentajes int** (evita el
  quirk de PostgREST que serializa `numeric` como string). Rutas bajo **`/pro/`**
  (no top-level) para heredar la guardia del `pro/layout` + proxy (evita hueco de
  acceso de pacientes). Justificante = **ruta de Storage** servida por URL firmada
  (`/receipts`), no URL pública.

**Límite del entorno (honesto):**
- Migración/tipos/seed/test **ya ejecutados** contra el remoto (ver arriba). El
  **deploy a Vercel** no se verificó aquí: si el proyecto de Vercel está conectado
  al repo, el push a `main` lo dispara automáticamente; compruébalo en el
  dashboard de Vercel (y que las envs VAPID/CRON/SERVICE estén configuradas).

**⚠️ TODO_VERIFICAR (confirmar contra AEAT antes de dar cifras por buenas), en `src/lib/fiscal/parametros/2026.ts`:**
- `gastosDificilJustificacionPct` (5% general; fue 7% excepcional en 2023) y
  `gastosDificilJustificacionTope` (2000 €/año).
- `retaTramos` 2026 (tabla de cuotas RETA por ingresos reales) — vacío, pendiente.

**Fases futuras (fuera de alcance):** OCR de justificantes y facturación vía API
certificada (opción B, Verifactu).

### Buscador de pacientes + datos de contacto en la ficha (jul 2026) 🟡 (código listo; migración pendiente de aplicar al remoto)

Solicitado por el usuario: buscador en la lista de pacientes (activos y
archivados) y más campos en la ficha (teléfono, correo, dirección, profesión…).

**Hecho:**
- Migración `20260723110001_patient_contact_fields.sql`: añade a `public.patients`
  las columnas `phone`, `birth_date`, `address`, `profession`,
  `emergency_contact` (todas `null` por defecto). **Idempotente**
  (`add column if not exists`); **sin cambios de RLS** (misma tabla, ya cubierta
  por las políticas de profesional/paciente; el `patients_guard` sigue vigente).
- **Buscador** en `/pro` (`PatientSearch.tsx`, client): input con icono, debounce
  250 ms, escribe/limpia el parámetro `?q=` conservando `status`/`tag`; envuelto
  en `<Suspense>` (usa `useSearchParams`). El filtrado es **server-side** en
  `listPatientsWithOverview` (nuevo campo `search` → `.or(ilike)` sobre
  `full_name/email/phone/profession`, con término saneado para PostgREST). Combina
  con las pestañas Activos/Archivados/Todos, así que busca en cualquiera de ellas.
  Estado vacío específico cuando no hay resultados para «q».
- **Ficha**: `PatientDetailsPanel.tsx` (client) en una **pestaña "Información"**
  (la primera, a la izquierda de "Tareas", y **pestaña por defecto**) — rejilla
  de 2 columnas con todos los campos (nombre, correo, teléfono, nacimiento +
  edad, profesión, dirección, emergencia) y edición inline
  (`updatePatientDetailsAction`). Permite además **editar el nombre** (antes no
  había forma tras el alta). La **edad** se calcula en el server
  (`ageFromBirthDate` en `lib/format.ts`) y viaja como prop (sin `now` en cliente
  → sin desajuste de hidratación). El aside de la ficha queda solo con la
  invitación.
- **Alta** (`/pro/patients/new`) y `createPatientAction` ampliados con los nuevos
  campos. Seed (`scripts/seed.mjs`) puebla datos de contacto ficticios por paciente.
- `database.types.ts` actualizado a mano (orden alfabético idéntico al que emite
  `gen:types`, para que regenerarlo no produzca ruido).
- Verificación local: `build` + `typecheck` + `lint` **OK**.

**⚠️ Pendiente de aplicar al remoto (bloqueante para el deploy):**
- Este entorno **no tiene `SUPABASE_ACCESS_TOKEN`** (falla `supabase db push` y
  `gen:types`) ni contraseña de BD en el pooler ni `psql`, así que **la migración
  no se pudo aplicar aquí**. Antes de desplegar hay que aplicarla, por cualquiera:
  1. `supabase db push` (tras `supabase login` o exportar `SUPABASE_ACCESS_TOKEN`), o
  2. pegar el SQL de la migración en el editor SQL del panel de Supabase.
  Después, opcional: `npm run gen:types` (los tipos ya coinciden). **Sin aplicarla,
  crear/editar pacientes y el buscador fallarán** (columnas inexistentes).
- El seed omite profesionales que ya tienen pacientes: para ver datos de contacto
  en los pacientes demo ya existentes habría que resembrar en limpio.

### Cierre de RLS antes de habilitar auth de pacientes (jul 2026) ✅ (aplicado y verificado en el remoto; `test:rls` 40/40)

Endurecimiento de RLS pensado para cuando los pacientes tengan cuenta real
(hoy solo datos ficticios). Adaptación del plan del usuario ("cierre de RLS v2")
al esquema y código reales. Migración
`20260725090001_rls_patient_hardening.sql`.

**PASO 0 (verificado):** los 4 helpers de RLS (`current_professional_id`,
`current_patient_id`, `current_patient_professional_id`,
`professional_owns_patient`) ya son `security definer` con `search_path=''`
(en `…002_identity.sql`). No se tocan.

**Fases (todas en la migración):**
1. **patients → solo lectura para el paciente:** se elimina `patients_update_self`
   (la ficha es documento clínico del profesional). No había UI de paciente que
   editara su ficha, así que sin impacto en la app.
2. **appointments → confirmar/cancelar por RPC:** se elimina
   `appointments_update_by_patient` (permitía UPDATE de cualquier columna:
   horario, notas del psicólogo…). Nueva `patient_respond_appointment(id, action)`
   que solo cambia `status` (confirmed/cancelled) de las citas propias.
   *Adaptación:* el plan hablaba de `attendance`; en este esquema el paciente
   actúa sobre `status` (attendance = registro clínico del profesional).
   `respondAppointmentAction` ahora llama a la RPC.
3. **consents → firma no falsificable:** se elimina `consents_insert_by_patient`
   (el `with_check` solo validaba patient_id → el interesado podía fabricar su
   propia evidencia del art. 9). Nueva `patient_accept_consent()` (SECURITY
   DEFINER, idempotente) que hashea el `body` de la **plantilla activa en BD**.
   Se introduce **plantilla por defecto por profesional**
   (`ensure_consent_template`, con el MISMO texto que `lib/consent.ts` v1):
   backfill de los existentes + creación en `handle_new_user` + seed.
   `completeOnboardingAction` ahora firma vía RPC (sin insert/hash en cliente).
4. **documents → columna `shared_with_patient` (default false)** + la política de
   lectura del paciente exige el flag. Protege la FILA, no el binario en Storage
   (revisar `storage.objects` aparte). Hoy no hay vista de documentos en `/app`,
   así que no se expone nada; el toggle del profesional se añadirá cuando exista
   esa vista.
5. **mood_entries → inmutable pasado el día:** se elimina el `ALL` del paciente;
   se separa en insert / select / update-hoy / delete-hoy. El campo `note` **no**
   se elimina (lo usa el `MoodLogger`).
6. **`patients_user_id_unique`** (índice único parcial): un `user_id` = un
   paciente (`current_patient_id()` es escalar).

Políticas nuevas envueltas en `(select public.helper())` (initPlan, se evalúa una
vez por consulta).

**invitations.token en claro** — RESUELTO (migración
`20260725100001_invitation_token_hash.sql`): la BD guarda solo el SHA-256
(`token_hash`, único, not null); `accept_invitation`/`invitation_preview`
hashean el token entrante; se elimina la columna `token`.
`createInvitationAction` genera el token (256 bits) en Node, guarda el hash y
devuelve el claro **una sola vez** para el enlace. `InvitePanel` ya no persiste
el enlace: si hay invitación activa muestra estado + "generar enlace nuevo".
Backfill del hash desde el token existente para no romper enlaces de demo (en
producción: invalidar+regenerar).

**Aplicado y verificado en el remoto:** el usuario aplicó ambas migraciones
(`20260725090001`, `20260725100001`) por el SQL editor. Verificado por conteos
(columnas nuevas, `token` eliminada, 3/3 plantillas de consentimiento) y por la
**batería completa contra el remoto**, con los tests actualizados a la conducta
endurecida: **`test:rls` 40/40** (antes 24; +patients solo-lectura, citas por
RPC, consent por RPC, diario inmutable, documentos cerrados), **`test:onboarding`
10/10** (consent por RPC), **`test:agenda` 14/14** (confirmar/cancelar por RPC),
`test:pro` 16/16 (invitación con hash); resto verdes (payments 10, wellbeing 10,
notifications 9, analytics 6, scales 12, contabilidad 14). `build`/`typecheck`/
`lint` OK.

**⚠️ Pendiente:**
- **Registro de migraciones:** como se aplicaron por el SQL editor (no
  `supabase db push`), `supabase_migrations` no las tiene marcadas. Ejecutar con
  token:
  `supabase migration repair --status applied 20260725090001 20260725100001`.
  Pasos exactos en `docs/DEPLOY.md` → "Reparación del historial de migraciones".
  Ambos ficheros **ya son idempotentes** (agosto 2026): las cuatro políticas
  `mood_entries_*` llevan `drop policy if exists` delante, y en
  `20260725100001` el backfill del token y el `drop column token` van dentro de
  guardas que comprueban que la columna existe. Antes, un `db push` habría
  abortado la cola entera.
- **Storage:** `shared_with_patient` protege la FILA `documents`, no el binario;
  revisar políticas de `storage.objects` cuando exista vista de documentos en `/app`.
- **Barrido de rendimiento** (opcional): envolver los helpers en `(select …)` en
  las ~50 políticas existentes de más volumen.

### Auditoría técnica (ago 2026) ✅ (código en verde; migraciones aplicadas y tipos regenerados)

Corrección completa de la auditoría en cuatro fases, rama `fix/auditoria-2026-08`.

**Fase 1 — lo que estaba roto en producción.** Toda la aritmética y el formateo
de fechas pasa por `src/lib/tz.ts` (`Europe/Madrid`): el runtime de Vercel es UTC
y las horas se mostraban con 2 h de desfase entre servidor y cliente. Las series
recurrentes se anclan en la cita original (respetan el cambio de horario y el
31 de mes). `revalidatePath` apuntaba a rutas inexistentes bajo `/contabilidad`
(no-op silencioso). Contraste AA en `--ink-3`, zoom desbloqueado, `error.tsx` y
`loading.tsx`, `try/catch` en las server actions del cliente.

**Fase 2 — control de acceso.** El rol pasa a `app_metadata`; se cierra el
autorregistro de profesionales; `createInvitationAction` y `accept_invitation`
validan propiedad y destinatario; Storage respeta `shared_with_patient`;
cabeceras de seguridad en `next.config.ts`; 401 explícito en los route handlers;
`?next=` validado; cron con `timingSafeEqual` y sin query string.

**Fase 3 — dinero y datos clínicos.** Los bonos se registran como ingreso al
venderlos; la liquidación de citas es atómica con operación inversa; las escalas
se validan en servidor y en trigger, y el ítem de riesgo avisa al profesional;
IVA sujeto/mixto, amortización prorrateada, tope del 130 prorrateado, trimestre
en hora española; zod en las actions de dinero y datos clínicos.

**Fase 4 — que no se rompa otra vez.** 76 tests de vitest sobre lógica pura
(motor fiscal, fechas, layout de agenda, escalas), integración movida a Supabase
local, Sentry con depuración de PII por lista blanca, `/api/health`, CI con build
y audit, `noUncheckedIndexedAccess`, paginación real del histórico de pagos y
batching del cron.

#### Migraciones — ✅ las seis aplicadas (9-ago-2026)

Seis migraciones nuevas, **todas aplicadas al remoto**, verificado con
`npm run gen:types`: el esquema generado trae todas sus columnas y funciones.
`src/lib/database.types.ts` ya no lleva nada escrito a mano.

Guía de verificación en `docs/MIGRACIONES-PENDIENTES.md`; el
detalle de qué hace cada una, en `docs/MIGRACIONES-PENDIENTES.md`.

El **historial del CLI está reparado**: las migraciones del repositorio constan
en `supabase_migrations.schema_migrations`, así que `db push` y `migration list`
vuelven a decir la verdad. Vuelve a desajustarse cada vez que se aplica algo
desde el editor SQL del panel; el arreglo está en
`supabase/scripts/reparar-historial.sql`.

🔴 **Queda una migración por aplicar:** `20260809100001_unsettle_informativo`,
salida de las pruebas manuales (ver abajo).

**Sigue pendiente:** las **comprobaciones funcionales**. Que el esquema tenga la
columna no demuestra que la RLS haga lo que debe. Están listadas por migración
en `docs/MIGRACIONES-PENDIENTES.md`: doble clic en "acudió", canje de invitación con el
correo equivocado, `list()` de Storage desde una sesión de paciente.

#### Hallazgos de las pruebas manuales (9-ago-2026)

- ✅ **Doble "acudió" → un solo pago.** El índice único sobre
  `payments(appointment_id)` y la RPC transaccional funcionan.
- 🔧 **"No acudió" no borraba el pago en un caso.** `unsettle_appointment` se
  niega —a propósito— a borrar un pago ya marcado como cobrado, pero lo hacía en
  silencio. Corregido en `20260809100001`: la RPC devuelve qué ha hecho y el
  modal lo enseña. De paso, deshacer un "acudió" ya devuelve el `status` de la
  cita de `completed` a `confirmed`.
- ℹ️ **La invitación con un correo distinto NO se rechaza en el login**, y es
  correcto: rechazarla ahí revelaría a quién va dirigida. `accept_invitation`
  la rechaza después, al volver del enlace del correo, en `/onboarding`.
  **Efecto colateral conocido:** ese intento crea una cuenta de auth huérfana
  (rol `patient`, sin fila en `patients`). No da acceso a nada, pero acumula
  basura en Auth. Sin resolver.

#### ⚠️ Cambios fiscales que necesitan validación

Todos cambian cifras que ya se han mostrado. Los cinco están implementados y
marcados aquí para que se validen con un asesor antes de darlos por buenos:

1. **IVA repercutido.** Con actividad `sujeta`/`mixta`, un cobro de 121 € ya no
   se registra como base 121 € / IVA 0 €. El rendimiento neto y los pagos
   fraccionados **bajan**. Con `exenta` (el caso normal) no cambia nada.
2. **Ingresos por base, no por total.** `resumenAnual` acumulaba `i.total`
   mientras calculaba la retención sobre `i.base`. El IRPF grava la base.
3. **Prorrata de IVA en régimen mixto.** Campo nuevo en Configuración. Sin él,
   el cálculo se **detiene** en vez de suponer el caso más favorable.
4. **Amortización prorrateada por días** desde la compra, e imputada solo desde
   su trimestre. Un bien comprado en noviembre ya no se amortiza el año entero.
5. **Tope de difícil justificación prorrateado por trimestre** (2000 × t/4).

Además, los parámetros sin confirmar contra la AEAT (`% y tope de difícil
justificación`) viajan marcados y el XLSX lleva una fila de aviso dentro.

#### Queda abierto

- **`FORCE ROW LEVEL SECURITY`**: ninguna tabla lo tiene, así que `service_role`
  y `postgres` lo leen todo. Activarlo exige antes dar políticas explícitas al
  propietario, porque `accept_invitation`, `patient_accept_consent` y
  `patient_respond_appointment` dependen de ese bypass. Trabajo aparte, con
  pruebas propias.
- **Editar una serie de citas completa.** Hoy la edición afecta solo a la
  ocurrencia, y la interfaz lo dice explícitamente. Falta el
  "esta / esta y siguientes / toda la serie".
- **Deep links nativos** (`assetlinks.json` / `apple-app-site-association`) para
  que `/invite/<token>` abra la app y no el navegador.
- **`FLAG_SECURE` en Android y overlay en `applicationWillResignActive` en iOS**:
  `NativeGate` ya no monta los hijos hasta desbloquear, pero la captura del
  conmutador de apps la hace el sistema y solo se evita desde la capa nativa.
- **Offline real.** Hay página de "sin conexión" y precache del shell; no hay
  funcionamiento sin red (y cachear datos clínicos en el dispositivo es una
  decisión de producto, no técnica).
- **`email_fallback`** se lee en el cron pero no se envía ningún correo: la
  opción sigue en la interfaz sin hacer nada. O se implementa o se quita.
- **Agregados del histórico de pagos en SQL.** Hoy se calculan en JS sobre un
  máximo de 5.000 filas; con más habría que pasarlos a una RPC.
- **`xlsx@0.18.5`**: excepción de `npm audit` documentada en
  `docs/DEPENDENCIAS.md` (solo se usa para escribir, nunca para parsear).

### PWA del paciente lista para demo (11-sep-2026) ✅ (en producción)

Objetivo: poder **enseñar la aplicación del paciente**. Rama
`feat/pwa-demo-20260911`, fusionada a `main`.

**Reserva de cita por el paciente.** Migración `20260911140001`: tabla
`appointment_requests` (kind `new`/`reschedule`/`cancel`) y tres funciones
`security definer` — `patient_request_appointment`, `patient_withdraw_request`,
`resolve_appointment_request`. La tabla **solo tiene políticas de SELECT**: no
hay insert ni update por API, así que el único camino de escritura son las
funciones. Aceptar crea o mueve la cita y cierra la solicitud en la misma
transacción, con `for update` sobre la solicitud y comprobación de solapes
contra citas y bloqueos. Tope de 3 solicitudes vivas por paciente, antelación
mínima de 1 h, y una sola pendiente por cita (índice único parcial).
Los mensajes de error nuevos van añadidos a `SQL_MESSAGES` en
`action-server.ts`; sin eso el paciente solo vería el error genérico.

Interfaz: `/pro/solicitudes` (con contador en `ProNav`, calculado en el layout)
y `/app/appointments/new` (día + franjas horarias, pensado para el pulgar).
La cancelación directa del paciente **se mantiene** por
`patient_respond_appointment`: no presentarse es su derecho, no una petición.

**Armazón de aplicación.** `AppTabBar` fija abajo con área segura de iOS
(Inicio · Citas · Diario · Recursos · Más), cabecera reducida a marca + 024,
nueva `/app/more` (pagos, notificaciones, contraseña, cerrar sesión), inicio
reordenado por la próxima cita y **`loading.tsx`** para toda el área de paciente
(el panel profesional ya tenía esqueletos; la app no tenía ninguno).

**Escenario de demostración** (`npm run seed:demo`, `scripts/seed-demo.mjs`).
`seed.mjs` dejaba la consulta **inservible para enseñarla**: ningún paciente con
cuenta, cero consentimientos firmados y la última cita el 19 de agosto. El nuevo
script da contraseña conocida a la profesional, hace el alta de una paciente por
el **camino real** (invitación → token → consentimiento) y refresca la línea
temporal. Idempotente. Credenciales ficticias: `dra.romero@demo.terapia` /
`ana.nadal@demo.terapia`.

**Verificación:** lint, tipos, compilación, 124 pruebas de lógica y **51
regresiones SQL** (13 nuevas). Además, **8 comprobaciones end-to-end contra la
base de datos real** con sesiones de usuario y RLS activa (pedir, ver, aceptar,
no falsificar, no resolver dos veces), con limpieza posterior.

**Notas de operación:** la migración se aplicó por la Management API (el CLI
necesita la contraseña de BD, que no está en este entorno) y se registró a mano
en `supabase_migrations.schema_migrations`. **40 migraciones registradas = 40
ficheros.** Los tipos se contrastaron con `supabase gen types` contra el remoto
y se devolvieron al formato del generador embebido, que es lo que valida
`npm run test:types` en CI.

**Renderizado en servidor de `/app` — corregido el mismo día.** `NativeGate`
arrancaba siempre en `checking` y no montaba a los hijos hasta resolver la
importación dinámica de Capacitor, así que **la PWA no servía nada de HTML**:
cada carga completa era una espera en blanco. Ahora Capacitor marca su WebView
(`appendUserAgent: "terapia-native"`) y `esAppNativa()`
(`src/lib/native-request.ts`) lo detecta en servidor: la web renderiza ya, el
contenedor nativo sigue esperando al desbloqueo. La comprobación en cliente se
mantiene por si un contenedor antiguo no trae la marca.

**Verificado en producción** (`terap.vercel.app`, sesiones reales por cookie):
**31/32 comprobaciones**. Cargan las siete vistas del panel y las siete de la
app, con el contenido correcto —contador de solicitudes, barra de pestañas,
franjas horarias, tareas, 024—.

🔴 **Limitación conocida, ANTERIOR a este trabajo, solo afecta al contenedor
nativo:** con el bloqueo activo la pantalla no pinta el contenido, pero el árbol
del servidor **sí viaja dentro del HTML** (como datos de hidratación), así que
es recuperable con herramientas de desarrollo. Es inherente a pasar hijos
renderizados en servidor a un componente cliente, y ya ocurría antes. Ahora que
el servidor sabe si la petición es nativa, se puede cerrar de verdad: no
renderizar los hijos y refrescar tras el desbloqueo. Requiere dispositivo real
para probarlo; va con `FLAG_SECURE` y el overlay de iOS.

**Pendiente:** repaso visual en navegador (la verificación es por HTML servido,
no por pantalla) e instalación como PWA en móvil real.

---

## Resumen del proyecto (plan v2)

Sesiones 0-9 y 11 **completas y verificadas** (build/lint/typecheck + tests contra
Supabase real). Sesión 10 (Capacitor) con código/config/docs listos; build nativo
pendiente de toolchains. Pendiente de ejecución manual (documentado): deploy Vercel,
build nativo iOS/Android, Lighthouse, envío push nativo (FCM) y fallback email.

**Tests (todos verdes):** `test:rls` `test:pro` `test:onboarding` `test:scales`
`test:agenda` `test:payments` `test:wellbeing` `test:notifications` `test:analytics`
`test:contabilidad`.

<!-- Reglas del agente para esta versión de Next.js -->

## UI/Diseño
- Skill instalada: .claude/skills/frontend-design (usar en sesiones de dashboard y PWA)
- Dirección estética: estilo Notion — fondo blanco #FFFFFF, texto #37352F, bordes #E9E9E7, radios 3-4px, tipografía de sistema, jerarquía por peso/tamaño, sombras mínimas, controles en hover
- Diferenciación: menos densidad que Notion; estados clínicos (alertas PHQ-9/GAD-7) visibles de un vistazo sin interacción
- **Rediseño completo aplicado (jul 2026):** sistema de tokens en `globals.css`
  (`:root` + `@theme inline`): `canvas/panel/wash/line/ink/ink-2/ink-3/accent/
  danger/warn/info` (+variantes `-soft`), modo oscuro automático vía
  `prefers-color-scheme` (las vistas NO usan `dark:`; usan los tokens).
  Clases base en `@layer components`: `btn-primary/ghost/subtle/danger`,
  `btn-sm`, `field`, `field-label`, `card`, `chip`, `page-title`,
  `section-label`, `row-hover`, `table-base`. Acento verde calmado
  (#0F7B6C claro / #4F9D8B oscuro). Tipografía 100% de sistema (sin Geist).
  Nota Tailwind v4: `@apply` no compone clases propias — la base de los
  botones se comparte por grupo de selectores.
- Landing `/` rediseñada: hero + maqueta CSS del panel (`AppWindow`) + grid de
  funcionalidades + principios + cierre. Sin JS de cliente.
- **Agenda con calendario (jul 2026):** `/pro/agenda` = calendario con vistas
  **día/semana/mes** (query params `?view=&date=`, navegación ‹ Hoy › por
  links server-rendered; ventana temporal resuelta en `src/lib/agenda-window.ts`,
  datos por rango con `getProfessionalAgendaRange`). Componente cliente
  `AgendaCalendar.tsx`: grid mensual (chips + "+N más"), rejilla horaria 7-21 h
  (solapes por carriles, línea de "ahora", bloqueos rayados), **popup** al
  pinchar una cita (vista previa + Ver paciente + Modificar) y **modal de
  edición** (horario, video, notas, asistencia, cancelar/eliminar).
  `AppointmentItem`/`BlockItem` eliminados (sustituidos por el calendario).
  Distribución: calendario a la izquierda; columna derecha con "Nueva cita",
  botón **"Ver todas las citas"** → `/pro/agenda/citas` (listado completo
  pasadas+futuras con filtros GET por cuándo/estado/paciente,
  `listProfessionalAppointments`) y "Nuevo bloqueo" plegado en `<details>`.
- Nav del panel con estado activo: `src/app/pro/_components/ProNav.tsx` (client).
  **Sidebar izquierda en escritorio** (`ProNav`, layout en rejilla
  `md:flex-row` con `<aside md:w-56>` fija + wordmark arriba y email/cerrar
  sesión abajo); en móvil, barra superior con nav horizontal (`ProNavMobile`).
- Acciones secundarias en listas aparecen en hover/focus (patrón Notion,
  `group-hover` + `group-focus-within`).
- **Refactor de sistema visual (jul 2026, revisado en artifact):** neutros a
  **zinc frío** (canvas `#FBFBFA`, ink `#1F1F23`, `line-strong` para bordes de
  control, `sunken` para hundidos); radios **6/10/12** (inputs 6, cards 10,
  modales 12); semánticos **desaturados** + `success` propio distinto del acento;
  `page-title` a peso **600**. Nuevas clases: `btn-lg`, `tabs/tab/tab-active`,
  `modal/modal-header/-body/-footer`, `toast`, `empty`, `skeleton`, y el sistema
  de **estados** `st` (punto+etiqueta) con `dot d-{tone}` (+`halo`) y `st-solid`
  (crítico, único con relleno). Componente `src/components/ui/Status.tsx`
  (`Status` + `StatusCritical`) usado en dashboard, ficha, agenda (popup), citas,
  citas del paciente y tareas.
- **Iconos: `lucide-react`** (dependencia) a grosor/tamaño uniforme (16 denso /
  ~20 PWA). **Sin emojis en la UI:** el `MoodLogger` y la maqueta de la landing
  usan caras Lucide (`Angry/Frown/Meh/Smile/Laugh`). Nav, botones clave (`Plus`),
  cabeceras y alertas (`TriangleAlert`) con iconos Lucide.
- **Tareas — fecha límite visible (jul 2026):** en `TasksPanel` la fecha dejó de
  ser texto gris al pie; ahora es una etiqueta con icono `CalendarDays` coloreada
  por urgencia (vencida = `danger-soft`+`· vencida`; próxima ≤2 días = `warn-soft`;
  resto neutra). "Hoy"/"pronto" se resuelven tras montar (mismo patrón que el
  "ahora" de `AgendaCalendar`) para no romper la hidratación.
- **Contabilidad (jul 2026):** nueva sección en el nav (`Calculator`) bajo
  `/pro/contabilidad` con la estética de tokens del proyecto: tarjeta grande de la
  estimación del modelo 130, tiles, tablas `table-base`, formularios con `field`/
  `field-label`, y un componente `DescargoFiscal` (banner `Info`, no descartable)
  presente en todas las vistas fiscales. Sin emojis (iconos Lucide).
- **Pagos — histórico + analítica (jul 2026):** query `getProfessionalPayments`
  (`src/lib/queries/payments.ts`) con filtros (rango de fechas, estado, método,
  paciente) y agregados (`byMethod`, `byMonth`, totales/conteos) sobre el conjunto
  filtrado; fecha efectiva = `paid_at ?? created_at`, filtro de rango en JS para
  ser consistente con lo mostrado. Nueva página **`/pro/pagos/historico`** (mismo
  patrón GET/presets que `/pro/agenda/citas`): filtros, tiles de resumen (cobrado/
  pendiente/nº/importe medio), **BarChart** de ingresos por mes + **`MethodBreakdown`**
  (barras por método), tabla paginada (25) y **Exportar CSV respetando filtros**
  (`/pro/pagos/export` ahora lee searchParams). `/pro/pagos` rediseñada: tiles
  clicables (Cobrado→histórico?status=paid, Pendiente→pending, Cobrado este mes,
  Pacientes con deuda), analítica (BarChart+MethodBreakdown) y tabla "Detalle por
  mes" con meses enlazados al histórico. Se eliminó `getAllPaymentsForExport`
  (lo sustituye la nueva query). Sigue sin facturar.
- **Selector de fecha propio (jul 2026):** `src/components/ui/DateField.tsx`
  (client) sustituye al calendario nativo de `<input type="date">` (que **no es
  estilizable** por CSS). Disparador con estética `.field` + calendario emergente
  con los tokens de la app: navegación de mes (‹ ›), **saltos rápidos de mes/año**
  por `<select>` (año: 120 atrás — cómodo para fechas de nacimiento), semana
  lunes-primero, día seleccionado en `accent`, "hoy" con anillo, acciones
  Borrar/Hoy. Cierre por click-fuera/Escape y navegación con flechas (roving
  `tabIndex`). Envía el valor por un `<input type="hidden">` (YYYY-MM-DD), así que
  funciona dentro de cualquier `<form>`. El popover **solo se renderiza al abrir**
  (client), por lo que usar `new Date()` para "hoy" no rompe la hidratación. Usado
  en el alta de paciente y en la pestaña Información de la ficha.
@AGENTS.md


### Correcciones integrales — copia aislada, 10-sep-2026

Rama `fix/correcciones-integrales-20260909-185808`. Once migraciones nuevas,
transacciones económicas, consentimiento versionado, guardas de escritura,
subidas firmadas, cron recuperable, históricos fiscales, errores estructurados,
CSP por nonce y dependencias corregidas. Informe y verificación actualizados en
[docs/CORRECCIONES-2026-09.md](docs/CORRECCIONES-2026-09.md).

No se ha desplegado ni migrado el remoto. La integración HTTP está preparada;
el motor de Docker local no está disponible. La validación de navegador sigue
pendiente del arranque permitido del servidor. Publicación Git pendiente por falta de remoto.
