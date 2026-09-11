import type { CapacitorConfig } from "@capacitor/cli";

/**
 * terap.ia es una app SSR: la app nativa carga la PWA desplegada (server.url).
 * Antes de compilar en una máquina con las toolchains nativas, define
 * CAP_SERVER_URL con la URL de producción (p. ej. https://terapia.vercel.app).
 * Si no se define, la app carga el `www/` incluido (placeholder).
 */
const config: CapacitorConfig = {
  appId: "com.terapia.app",
  appName: "terap.ia",
  webDir: "www",
  // Marca el WebView para que el servidor distinga la app nativa de la web.
  // Sin esto, el servidor no puede saberlo (el contenedor carga el MISMO sitio
  // desplegado) y la única salida era no renderizar nada hasta que JavaScript
  // resolviera la plataforma: en la PWA eso convertía cada carga en una espera
  // en blanco. Ver `NativeGate` y `esAppNativa` en `src/lib/native-request.ts`.
  appendUserAgent: "terapia-native",
  server: {
    ...(process.env.CAP_SERVER_URL
      ? { url: process.env.CAP_SERVER_URL, cleartext: false }
      : {}),
    // Sin `allowNavigation`, el WebView puede navegar a CUALQUIER origen. Con
    // una redirección abierta (la que se cerró en la fase 2) eso ponía el sitio
    // del atacante dentro del chrome de la app nativa, con su icono y su
    // apariencia de aplicación legítima.
    allowNavigation: ["terap.ia", "*.terap.ia"],
  },
  android: {
    // Nada de contenido mixto: son datos de salud.
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
