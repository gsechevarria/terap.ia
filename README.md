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
| `npm run lint` | ESLint 9 (flat config), sin warnings permitidos |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | **vitest**: lógica pura, sin base de datos |
| `npm run test:cov` | lo mismo con cobertura |
| `npm run test:integration` | batería contra **Supabase local** (ver abajo) |
| `npm run db:push` | aplica las migraciones al proyecto remoto |
| `npm run gen:types` | regenera `src/lib/database.types.ts` |
| `npm run cap:*` | Capacitor (sync, add, open) |

## Tests

**`npm test` no toca ninguna base de datos.** Cubre el motor fiscal, la
aritmética de fechas y zonas horarias, el reparto en carriles de la agenda y la
puntuación de las escalas. Se ejecuta en UTC en CI a propósito: es la zona del
runtime de Vercel y donde estaban los fallos de fecha.

La batería de **integración** sí necesita base de datos, y va contra una local:

```bash
supabase start                 # imprime URL y claves
cp .env.test.example .env.test # y pega esos valores
supabase db reset              # aplica todas las migraciones en limpio
npm run test:integration
```

> ⚠️ **Nunca la apuntes al proyecto remoto.** Crea usuarios en Auth e inserta
> pacientes, citas, pagos y ficheros. Limpia en un `finally`, pero si el proceso
> muere (timeout, Ctrl-C) ese `finally` no corre y deja basura en producción.
> Por eso los scripts leen `.env.test` y no `.env.local`.

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
