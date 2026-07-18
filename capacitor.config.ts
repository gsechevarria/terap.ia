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
  server: process.env.CAP_SERVER_URL
    ? { url: process.env.CAP_SERVER_URL, cleartext: false }
    : undefined,
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
