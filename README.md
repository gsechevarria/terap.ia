# terap.ia

SaaS para **psicólogos de consulta privada** y sus pacientes: agenda, fichas,
tareas, escalas clínicas (PHQ-9 / GAD-7) opt-in, diario emocional, seguimiento
de pagos y contabilidad de autónomo en España.

Dos áreas sobre el mismo despliegue: **`/pro`** (panel del profesional) y
**`/app`** (PWA del paciente, envuelta con Capacitor para iOS/Android).

**Límites de producto, vinculantes:** la aplicación **nunca emite facturas**
(evita Verifactu) y **nunca interpreta ni recomienda** clínicamente (evita la
reclasificación como producto sanitario bajo MDR). Los datos son de salud
mental: categoría especial del **art. 9 RGPD**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4
(configuración en CSS, sin `tailwind.config.js`) · Supabase (Postgres, Auth,
Storage, RLS) en EU-Frankfurt · Capacitor 8 · desplegado en Vercel.

> En Next.js 16 el middleware se llama **`proxy`** (`src/proxy.ts`) y `cookies()`
> es asíncrono.

## Requisitos

- Node.js 20 o superior
- Una cuenta de Supabase con un proyecto en la UE
- Supabase CLI (va como devDependency: `npx supabase …`)

## Arrancar en local

```bash
npm install
cp .env.example .env.local     # y rellena los valores reales
npm run dev                    # http://localhost:3000
```

En Supabase → Authentication → URL Configuration, añade
`http://localhost:3000/auth/confirm` a las *Redirect URLs*.

**`.env.local` nunca se sube al repositorio** (`.gitignore` cubre `.env*`; solo
se versiona `.env.example`). Contiene la `service_role`, que salta la RLS.

## Datos de demostración

```bash
npm run seed                                  # 2 profesionales, 10 pacientes, ~3 meses
SEED_PRO_EMAIL=tu-correo@dominio npm run seed # para entrar tú por enlace mágico
```

Es idempotente. **Usa la `service_role` contra la base de datos real.**

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | ciclo de Next.js |
| `npm run lint` | ESLint 9 (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | aplica las migraciones al proyecto remoto |
| `npm run gen:types` | regenera `src/lib/database.types.ts` |
| `npm run test:*` | baterías contra Supabase real (rls, pro, agenda, pagos…) |
| `npm run cap:*` | Capacitor (sync, add, open) |

## Estructura

```
src/
  proxy.ts              # sesión + redirección optimista por rol
  app/
    pro/                # panel del profesional (guard: professional)
    app/                # PWA del paciente (guard: patient)
    login/ auth/ onboarding/ invite/
    api/cron/           # envío programado de notificaciones
  lib/
    queries/            # lectura
    actions/            # escritura (server actions)
    fiscal/             # motor del modelo 130 y libros registro
    supabase/           # clientes browser / server
    tz.ts               # zona horaria del dominio (Europe/Madrid)
  components/
supabase/migrations/    # esquema y RLS, siempre versionados
docs/                   # DEPLOY, GUION_DEMO, PUBLICACION_STORES
```

## Convenciones

- **Autorización real = RLS de Postgres.** Los layouts y el proxy son defensa en
  profundidad, no la barrera.
- Toda la fecha y la hora pasan por `src/lib/tz.ts` (`Europe/Madrid`): el
  runtime del servidor es UTC y no se puede depender de su zona.
- Nunca se cambia el esquema sin migración en `supabase/migrations/`.
- Idioma de la interfaz: español.

Contexto ampliado y estado sesión a sesión en [`CLAUDE.md`](./CLAUDE.md).
