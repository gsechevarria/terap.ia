# Deploy (Vercel) y Lighthouse

## 1. Variables de entorno (Vercel → Project → Settings → Environment Variables)

| Variable | Ámbito | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | todos | URL del proyecto Supabase (EU) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | todos | clave publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | Production/Preview | secreta; la usa el cron |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | todos | Web Push |
| `VAPID_PRIVATE_KEY` | Production/Preview | secreta |
| `VAPID_SUBJECT` | todos | `mailto:...` |
| `CRON_SECRET` | Production/Preview | autoriza `/api/cron/notifications` |
| `TZ` | todos | `Europe/Madrid`. Red de seguridad, ver abajo |

> Los valores están en tu `.env.local` (que **no** se versiona). Cópialos a Vercel.

### Sobre `TZ`

El runtime de Vercel corre en **UTC**. `TZ=Europe/Madrid` se declara como red de
seguridad, pero **el código no debe depender de ella**: toda la aritmética y el
formateo de fechas pasa por `src/lib/tz.ts`, que fija la zona explícitamente. Si
borrases la variable, la aplicación debe seguir mostrando las horas correctas.

Regla al escribir código nuevo: nada de `getHours()`, `getDate()`, `setMonth()`
ni `toLocaleString()` sin `timeZone`. Usa `wallClockParts` / `fromWallClock` /
`todayYMD` de `lib/tz`, y los formateadores de `lib/format`.

## 2. Desplegar

```bash
npm i -g vercel        # o npx vercel
vercel login
vercel link            # vincula el repo al proyecto
vercel --prod          # despliega a producción
```

## 3. Supabase (post-deploy)
- Authentication → **URL Configuration**: *Site URL* = `https://<dominio>` y
  añade `https://<dominio>/**` a **Redirect URLs** (para el enlace mágico).

## 3 bis. Reparación del historial de migraciones — **pendiente, hazlo antes del próximo `db push`**

Dos migraciones se aplicaron desde el editor SQL del panel y por tanto **no
están registradas** en la tabla `supabase_migrations.schema_migrations`:

- `20260725090001_rls_patient_hardening.sql`
- `20260725100001_invitation_token_hash.sql`

Como el CLI las ve pendientes, el próximo `supabase db push` intentaría
reejecutarlas. Ambas se han hecho reejecutables (`drop policy if exists` antes
de cada `create policy`, y el backfill del token y el `drop column` envueltos en
guardas que comprueban que la columna `token` todavía existe), así que ya no
reventarían la cola — pero el registro sigue estando mal y conviene arreglarlo.

Ejecútalo tú (requiere `SUPABASE_ACCESS_TOKEN` o `supabase login`):

```bash
supabase migration repair --status applied 20260725090001 20260725100001
supabase migration list   # verificar que ambas figuran como aplicadas
```

Comprueba que la salida de `migration list` marca las dos como aplicadas en
local y en remoto antes de lanzar ningún `db push` nuevo.

## 4. Cron de notificaciones

`vercel.json` define el cron `/api/cron/notifications` con `0 8 * * *`, es decir
**una vez al día** a las 08:00 UTC — no cada hora.

No es un descuido: **en el plan Hobby de Vercel una expresión horaria
(`0 * * * *`) hace fallar el deploy**, porque Hobby solo admite crones diarios.
Y no hace falta más: la ventana de recordatorio es de 24-48 h, así que dos
ejecuciones diarias consecutivas cubren franjas contiguas y cada cita recibe
exactamente un aviso (el encolado es idempotente por `payload.appointment_id`).

Con un plan Pro puede volver a ponerse horario sin tocar el código.

Vercel envía `Authorization: Bearer $CRON_SECRET` automáticamente si
`CRON_SECRET` está en el entorno. El handler **solo** acepta la cabecera: la vía
por query string (`?secret=`) se retiró para que el secreto no acabe en los logs
de acceso.

## 5. Seed de demo
```bash
SEED_PRO_EMAIL=tu-correo@dominio npm run seed
```
Idempotente. Usa un correo real para poder entrar por enlace mágico.

## 6. Lighthouse (PWA)
```bash
npm run build && npm run start          # servir el build de producción
npx lighthouse http://localhost:3000/app --view --preset=desktop
# y en móvil (por defecto) para PWA/instalabilidad
npx lighthouse http://localhost:3000/app --view
```
La PWA ya incluye manifest (`/manifest.webmanifest`), service worker (`/sw.js`) e
iconos 192/512 (Sesión 3). Revisa las categorías PWA/Rendimiento/Accesibilidad.

## Nota
El deploy y Lighthouse no se ejecutaron en el entorno de desarrollo (sin token de
Vercel ni Chrome); estos pasos se realizan en tu máquina/CI.
