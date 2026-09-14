# Capacitor o Expo: qué cliente nativo se queda

**14 de septiembre de 2026.** Hoy conviven dos caminos hacia la app nativa del
paciente y ninguno está publicado. Este documento compara lo que hay de verdad
—no lo que estaba planeado— y recomienda uno. **La decisión es tuya**; al final
está el plan concreto para ejecutarla.

## Qué hay realmente en cada lado

| | Capacitor (este repo) | Expo (`C:\dev\terap-app`) |
|---|---|---|
| Qué es | Un contenedor que carga **la PWA desplegada** en un WebView | Una app nativa de verdad, con su propia interfaz |
| Código | `capacitor.config.ts`, `www/` de relleno, y 266 líneas en tres ficheros: `native.ts`, `native-request.ts`, `NativeGate.tsx` | Repo completo: Expo Router, i18n, tema, SecureStore, pruebas |
| Pantallas propias | Ninguna: reutiliza las de `/app` | Acceso, registro, recuperación, nueva contraseña, canje de invitación, inicio y ajustes |
| Proyectos nativos | **No existen.** `android/` e `ios/` están en `.gitignore` y nunca se generaron | EAS Build en la nube |
| ¿Se ha compilado alguna vez? | **No.** Requiere Xcode y Android SDK; consta como límite del entorno desde la sesión 10 | Sí, se desarrolla contra Android e iPhone físicos con Expo Go |
| ¿Funciona desde Windows? | No para iOS | Sí: EAS compila en la nube, sin Mac |
| Dependencias que arrastra | 6 paquetes `@capacitor/*` + biometría + `@capacitor/assets` (con `overrides` de `sharp` y `tar`) | Ninguna en este repo |

El dato que más pesa: **Capacitor lleva desde la sesión 10 sin producir un solo
build instalable**, y el motivo no ha cambiado (este es un entorno Windows sin
toolchains nativas). Expo, en cambio, ya corre en los dos teléfonos del equipo.

## Qué se pierde si se retira Capacitor

No es gratis, y conviene decirlo antes que las ventajas:

1. **El bloqueo biométrico.** `NativeGate` es hoy la única implementación de
   «desbloquea para ver tus datos». La app Expo tendría que rehacerlo con
   `expo-local-authentication`.
2. **El registro de push nativo.** `saveNativePushTokenAction` y la tabla
   `device_push_tokens` se alimentan desde el contenedor. La tabla y su RLS se
   quedan —son del backend, que Expo comparte—, pero quien las rellena cambia.
   Como el emisor FCM/APNs no existe todavía, **hoy no hay pérdida real**.
3. **Un camino a las tiendas que ya estaba documentado**
   (`docs/PUBLICACION_STORES.md`). Buena parte sigue valiendo: los requisitos de
   privacidad de datos de salud de App Store y Play Store no dependen del
   envoltorio.

Lo que **no** se pierde: la PWA. Seguir siendo instalable desde el navegador no
depende de Capacitor.

## Qué cuesta mantener los dos

Cada cambio de esquema, RLS, RPC o configuración de Auth afecta a dos clientes.
No es teórico: las solicitudes de cita (migración `20260911140001`) añadieron
tres funciones `security definer` y una tabla sin políticas de escritura. La PWA
las usa; la app Expo, no. Cada funcionalidad nueva nace con esa deuda.

Y hay una asimetría incómoda: el contenedor Capacitor **no es un cliente
distinto**, es la misma PWA dentro de un WebView. Todo el trabajo de producto se
hace una vez para la web y otra para Expo; Capacitor no ahorra ninguna de las
dos, solo añade una tercera forma de desplegar la primera.

## Recomendación: retirar Capacitor, quedarse con PWA + Expo

Tres razones, por orden de peso:

1. **Capacitor no ha entregado nada y su bloqueo es estructural**, no de
   calendario: no hay Mac ni Android SDK, y Expo resuelve exactamente eso con
   EAS. Mantener un camino que no puede recorrerse desde el equipo que tienes es
   deuda pura.
2. **Duplicidad sin contrapartida.** Dos clientes es caro; tres formas de
   empaquetar dos clientes, absurdo.
3. **Simplifica la PWA.** `NativeGate` y `esAppNativa()` existen para que el
   servidor distinga el WebView del navegador. Sin contenedor, `/app` se
   renderiza en servidor y punto — y desaparece la limitación conocida de que el
   árbol del servidor viaja en el HTML aunque la pantalla esté bloqueada.

**Con una condición:** que la app Expo se comprometa a cubrir lo que hoy solo
está en la PWA antes de retirar nada de la parte visible. Hoy le faltan citas,
tareas, escalas, diario, recursos, pagos y solicitudes de cita.

## Si decides que sí — plan por fases

**Fase 1, ahora y sin riesgo:** quitar las dependencias `@capacitor/*`, la
biometría y `@capacitor/assets` de `package.json` (con sus `overrides` de `sharp`
y `tar`), borrar `capacitor.config.ts`, `www/` y los scripts `cap:*`. Reduce
superficie de auditoría y no toca nada que funcione.

**Fase 2, con cuidado:** retirar `NativeGate` del layout de `/app` y simplificar
`native-request.ts`. Aquí está la pregunta de producto: **¿la PWA debe seguir
teniendo bloqueo al abrir en un dispositivo compartido?** Si la respuesta es sí,
no se retira `NativeGate`, se sustituye por un bloqueo web (WebAuthn o PIN), y
eso es un encargo aparte.

**Fase 3, en el otro repo:** `expo-local-authentication` para el bloqueo y
`expo-notifications` para el push, cuando exista emisor FCM/APNs.

**Lo que NO cambia en ningún caso:** el backend. La tabla `device_push_tokens`,
su RLS y las RPC se quedan como están. Expo ya las comparte.

## Por qué no lo he ejecutado

Podría haber hecho la fase 1 en este mismo cambio. No lo he hecho porque la
fase 2 lleva detrás una decisión de producto que no me corresponde —si la app del
paciente conserva o no bloqueo al abrir en un dispositivo compartido— y retirar
las dependencias dejando `NativeGate` montado sería dejar el repo a medias, con
un componente que importa paquetes que ya no están.

Dime qué eliges y lo ejecuto: la fase 1 completa es un cambio de media hora.
