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

> Los valores están en tu `.env.local` (que **no** se versiona). Cópialos a Vercel.

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

## 4. Cron de notificaciones
- `vercel.json` define el cron (`/api/cron/notifications`, cada hora). Vercel envía
  `Authorization: Bearer $CRON_SECRET` automáticamente si `CRON_SECRET` está en el
  entorno. **Plan Hobby**: la frecuencia de cron puede limitarse a diaria; para
  recordatorios sub-diarios usa un plan con cron frecuente o un cron externo.

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
