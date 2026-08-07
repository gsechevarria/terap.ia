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
 *
 * DECISIÓN, documentada a propósito: si el dispositivo NO tiene biometría ni
 * código configurados, se deja pasar en vez de bloquear. Bloquear dejaría al
 * paciente sin poder abrir su propia app —incluidos los enlaces de emergencia—
 * sin ninguna forma de resolverlo desde dentro, y el contenido sigue protegido
 * por la sesión y por la RLS. El bloqueo biométrico aquí es una capa cómoda
 * frente a "alguien coge mi móvil desbloqueado", no la barrera de seguridad.
 *
 * `allowDeviceCredential: true` hace que baste el PIN del dispositivo, así que
 * el caso de "sin biometría pero con código" sí queda cubierto.
 */
export async function requireBiometricUnlock(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return true;
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return true; // ver nota de arriba
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
 * Avisa cuando la app pasa a primer o segundo plano.
 *
 * `NativeGate` lo usa para volver a bloquear al salir: sin esto, quien recupere
 * un móvil ya desbloqueado entra directo al historial clínico.
 * Devuelve una función para quitar el listener.
 */
export async function onNativeAppStateChangeAsync(
  onChange: (activa: boolean) => void,
): Promise<() => void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return () => {};
    const { App } = await import("@capacitor/app");
    const handle = await App.addListener("appStateChange", ({ isActive }) => {
      onChange(isActive);
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}

/** Versión síncrona para usar en un `useEffect` sin `await`. */
export function onNativeAppStateChange(
  onChange: (activa: boolean) => void,
): () => Promise<void> {
  const pendiente = onNativeAppStateChangeAsync(onChange);
  return async () => {
    (await pendiente)();
  };
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

    // El listener espera un callback síncrono: se envuelve el trabajo asíncrono
    // con `void` y su propio `catch`, o el rechazo quedaría sin gestionar.
    await PushNotifications.addListener("registration", (token) => {
      const platform: NativePlatform =
        Capacitor.getPlatform() === "ios" ? "ios" : "android";
      void save(platform, token.value).catch((e: unknown) => {
        console.error("[native] no se ha podido guardar el token push", {
          message: e instanceof Error ? e.message : "desconocido",
        });
      });
    });
    await PushNotifications.register();
  } catch {
    /* silencioso: el push nativo es best-effort */
  }
}
