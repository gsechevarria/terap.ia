# Apps nativas (Capacitor) y publicación en las stores

La app del paciente es una PWA SSR. Con Capacitor la envolvemos en apps nativas
iOS/Android que **cargan la PWA desplegada** (`server.url`) y añaden **push nativo**
(FCM/APNs) y **bloqueo biométrico**.

> Requisitos que **no** existen en el entorno de desarrollo actual (Windows):
> - iOS: macOS con **Xcode** (obligatorio; no se puede compilar iOS en Windows).
> - Android: **Android Studio + SDK** y JDK 17.
> Por eso los proyectos `android/` e `ios/` se generan en esas máquinas (están en
> `.gitignore`) y el *build en dispositivo* se hace allí.

## Generar y compilar

```bash
# 1) URL de la PWA desplegada (la app nativa la carga como WebView)
export CAP_SERVER_URL="https://<tu-dominio>"   # p.ej. https://terapia.vercel.app

# 2) Añadir plataformas (una vez, en la máquina con las toolchains)
npm run cap:add:android
npm run cap:add:ios         # solo en macOS

# 3) Iconos y splash (usa public/icon-512.png como fuente si configuras assets/)
npm run cap:assets

# 4) Sincronizar web + plugins con los proyectos nativos
npm run cap:sync

# 5) Abrir en el IDE nativo para compilar/firmar/ejecutar
npm run cap:open:android    # Android Studio
npm run cap:open:ios        # Xcode (macOS)
```

## Push nativo (sustituye Web Push en nativo)

- **Android (FCM):** crea proyecto Firebase, descarga `google-services.json` a
  `android/app/`. El token se registra con `@capacitor/push-notifications` y se
  guarda en `device_push_tokens` (`saveNativePushTokenAction`).
- **iOS (APNs):** activa *Push Notifications* + *Background Modes* en Xcode, sube
  la key APNs a Firebase (si usas FCM para ambos).
- **Envío:** el cron actual (`/api/cron/notifications`) envía Web Push. Para el
  push nativo hay que añadir un envío vía FCM Admin (server key) leyendo
  `device_push_tokens` — pendiente (backlog): requiere credenciales FCM.

## Bloqueo biométrico

- Plugin `@aparajita/capacitor-biometric-auth`; `NativeGate` exige desbloqueo al
  abrir (huella/Face ID, con *fallback* a código del dispositivo).
- **iOS:** añadir en `Info.plist` la clave **`NSFaceIDUsageDescription`**
  (p. ej. "Usamos Face ID para proteger el acceso a terap.ia").
- **Android:** permiso `USE_BIOMETRIC` (lo aporta el plugin).

## Checklist de publicación (datos de salud)

**Ambas stores**
- Declarar que se tratan **datos de salud** y con qué finalidad.
- Cifrado en tránsito (HTTPS/TLS) y en reposo (Supabase). No se venden datos.
- Política de privacidad accesible + borrado de cuenta.
- Mientras dure la demo: **solo datos ficticios** (banner permanente).

**App Store (Apple)**
- *App Privacy* → *Health & Fitness / Sensitive Info*: uso, vinculación con
  identidad, no tracking.
- `NSFaceIDUsageDescription`, capacidad de Push (APNs), *Account Deletion*.
- Revisar guía 1.4/5.1 (datos médicos): sin diagnóstico ni interpretación clínica
  (coherente con las decisiones v2).

**Play Store (Google)**
- *Data safety*: tipos de datos (salud), recogida/compartición, cifrado.
- Declaración *Health apps* si aplica; `POST_NOTIFICATIONS` (Android 13+).
- Firma con Play App Signing.

## Notas de arquitectura
- `capacitor.config.ts`: `appId=com.terapia.app`, `webDir=www`, `server.url` desde
  `CAP_SERVER_URL`.
- El código nativo (push/biometría) está en `src/lib/native.ts` y se activa solo
  con `Capacitor.isNativePlatform()`: la PWA web no se ve afectada.
