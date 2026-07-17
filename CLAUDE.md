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
- Auth por **email + magic link** (sin contraseña) vía `@supabase/ssr`.
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

<!-- Reglas del agente para esta versión de Next.js -->
@AGENTS.md
