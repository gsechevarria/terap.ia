// Helpers para la app nativa (Capacitor). Todo se importa de forma dinámica y
// solo actúa en nativo: en la web (PWA) estas funciones son inocuas.

export type NativePlatform = "ios" | "android";

export async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Pide desbloqueo biométrico al abrir en nativo. Devuelve true si procede
 * mostrar la app (biométrica correcta o no disponible), false si falla.
 */
export async function requireBiometricUnlock(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return true;
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return true; // sin biometría configurada: no bloquear
    await BiometricAuth.authenticate({
      reason: "Desbloquea terap.ia",
      cancelTitle: "Cancelar",
      allowDeviceCredential: true,
      iosFallbackTitle: "Usar código",
      androidTitle: "terap.ia",
      androidSubtitle: "Verifica tu identidad",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Registra el push nativo (FCM/APNs) y guarda el token con el callback dado.
 * No hace nada en web (allí se usa Web Push).
 */
export async function registerNativePush(
  save: (platform: NativePlatform, token: string) => Promise<void>,
): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (token) => {
      const platform: NativePlatform =
        Capacitor.getPlatform() === "ios" ? "ios" : "android";
      await save(platform, token.value);
    });
    await PushNotifications.register();
  } catch {
    /* silencioso: el push nativo es best-effort */
  }
}
