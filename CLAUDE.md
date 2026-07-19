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
- **Rol:** resuelto SIEMPRE por `src/lib/auth/roles.ts` (`getUserRole`).
  - Sesión 0 (bootstrap): el rol vive en el metadata del usuario y se fija en el
    primer acceso (`signInWithOtp({ options: { data: { role } } })`).
  - **Sesión 1:** el rol migrará a la tabla `profiles` con RLS. Al hacerlo, solo
    debe cambiar `getUserRole` — el resto del código no.

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

---

## Resumen del proyecto (plan v2)

Sesiones 0-9 y 11 **completas y verificadas** (build/lint/typecheck + tests contra
Supabase real). Sesión 10 (Capacitor) con código/config/docs listos; build nativo
pendiente de toolchains. Pendiente de ejecución manual (documentado): deploy Vercel,
build nativo iOS/Android, Lighthouse, envío push nativo (FCM) y fallback email.

**Tests (todos verdes):** `test:rls` `test:pro` `test:onboarding` `test:scales`
`test:agenda` `test:payments` `test:wellbeing` `test:notifications` `test:analytics`.

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
- Nav del panel con estado activo: `src/app/pro/_components/ProNav.tsx` (client).
- Acciones secundarias en listas aparecen en hover/focus (patrón Notion,
  `group-hover` + `group-focus-within`).
@AGENTS.md
