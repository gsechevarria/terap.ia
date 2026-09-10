> Estado de la copia de correcciones (10-sep-2026): consultar primero
> [CORRECCIONES-2026-09.md](CORRECCIONES-2026-09.md). No hay despliegue realizado.
> El código nuevo necesita las once migraciones de septiembre antes de servir
> tráfico. `vercel.json` solicita cron cada minuto: confirmar plan compatible
> o configurar un programador externo autenticado antes de desplegar.
> Vercel Hobby limita cron a una ejecución diaria, según su
> [documentación](https://vercel.com/docs/cron-jobs/usage-and-pricing).
> Mantener `NEXT_PUBLIC_NATIVE_PUSH_ENABLED=false`: no existe emisor FCM/APNs.
> El fallback por email no está disponible; la interfaz ya no lo ofrece.
> Sentry requiere activación explícita; nunca se habilitan trazas de salud.

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
| `NEXT_PUBLIC_SITE_URL` | todos | URL pública sin barra final. **Obligatoria**: la usan los enlaces de invitación |
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

## 3 bis. Reparación del historial de migraciones — ✅ hecho (9-ago-2026)

Aplicar una migración pegándola en el editor SQL del panel **no** actualiza
`supabase_migrations.schema_migrations`, así que el CLI la sigue viendo
pendiente y un `db push` futuro intentaría reejecutarla.

Ya está reparado, pero **vuelve a pasar cada vez que apliques algo desde el
panel**. Cuando ocurra:

Con el CLI (requiere `SUPABASE_ACCESS_TOKEN` o `supabase login`):

```bash
supabase migration repair --status applied 20260725090001 20260725100001
supabase migration list   # verificar que ambas figuran como aplicadas
```

**Sin CLI**, desde el editor SQL del panel: `supabase/scripts/reparar-historial.sql`
hace lo mismo. Trae un diagnóstico que compara todas las migraciones del
repositorio con lo que el CLI tiene registrado y marca cuáles faltan; repara
solo esas.

Comprueba que la salida de `migration list` coincide en local y en remoto antes
de lanzar ningún `db push` nuevo.

## 3 ter. Configuración de Auth en el panel de Supabase — **pendiente**

`supabase/config.toml` es el fichero **local**: describe el objetivo, pero la
configuración que manda está en el panel del proyecto remoto y hay que
cambiarla a mano. Lista de lo que falta, en Authentication → *Settings* salvo
donde se indique:

| Ajuste | Ahora | Objetivo | Por qué |
|---|---|---|---|
| Minimum password length | 6 | **12** | Datos del art. 9 |
| Password requirements | ninguno | **mayúsculas + minúsculas + dígitos + símbolos** | |
| Confirm email | **off** | **on** | Hoy el correo no se verifica nunca, y es la identidad con la que se canjea la invitación |
| Secure password change | **off** | **on** | Sin ello, una sesión robada permite tomar la cuenta |
| Email OTP expiry | 3600 s | **600 s** | |
| MFA (TOTP) | deshabilitado | **enroll + verify** para cuentas `pro` | Requiere plan Pro |
| Session timebox | sin límite | **12 h** | |
| Session inactivity timeout | sin límite | **30 min** | |
| CAPTCHA | off | **on (Turnstile)** | Frena el abuso del envío de enlaces |
| Leaked password protection (HIBP) | off | **on** | |
| Database → Network restrictions | `0.0.0.0/0` | **CIDR de Vercel + oficina** | Rellena los rangos **antes** de activarlo o cortas la app |
| Database → SSL enforcement | off | **on** | |

Y en Authentication → **URL Configuration**, revisa que las *Redirect URLs* no
tengan comodines de más: `/auth/confirm` ya valida el `?next=` contra una lista
blanca, pero la allow-list de Supabase es la primera barrera.

### Nota, sin implementar: `FORCE ROW LEVEL SECURITY`

Ninguna tabla lo tiene activado, así que el rol `postgres` (y cualquier
conexión con la `service_role`) lo lee todo saltándose la RLS. Activarlo exige
antes dar políticas explícitas al propietario, porque hoy `accept_invitation`,
`patient_accept_consent` y `patient_respond_appointment` dependen justamente de
ese bypass de propietario para funcionar. Es un trabajo aparte y con su propia
batería de pruebas: **no se ha tocado en esta fase**.

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

## 4 bis. Vigilancia del cron

El cron es el único camino por el que salen los recordatorios y las alertas de
ítem de riesgo. Si dejara de ejecutarse, **nadie se enteraría** hasta que un
paciente se quejase de haber faltado a una sesión.

Desde ago 2026 el endpoint devuelve **500** ante cualquier error de consulta (y
no `{ ok: true, sent: 0 }`, que era éxito aparente con cero trabajo hecho), así
que basta con vigilar el código de estado.

Configura una alerta —Better Stack, Cronitor, o el monitor que uses— con:

- **Health check:** `GET https://<dominio>/api/health` cada 5 min. Devuelve 503
  si Postgres no responde.
- **Heartbeat del cron:** aviso si `/api/cron/notifications` **no reporta un 200
  en 26 horas** (el cron es diario a las 08:00 UTC; 26 h da margen para un
  reintento sin generar falsos positivos).
- **Alerta inmediata** ante cualquier 500 del cron.

El cuerpo de la respuesta trae el desglose para diagnosticar sin abrir logs:
`{ ok, remindersCreated, sent, failed, retrying, skipped }`.

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
