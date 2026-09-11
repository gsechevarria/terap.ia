import "server-only";
import { headers } from "next/headers";

/** Marca que Capacitor añade al identificador del WebView (`capacitor.config.ts`). */
export const NATIVE_UA_MARK = "terapia-native";

/**
 * ¿La petición viene del contenedor nativo?
 *
 * La app nativa carga el MISMO sitio desplegado (`server.url`), así que sin una
 * marca en el identificador del navegador el servidor no puede distinguirlas.
 * Se usa para decidir si el contenido del paciente puede renderizarse ya o
 * tiene que esperar al desbloqueo biométrico.
 *
 * Se asume **web** cuando no hay marca. Es lo correcto en los dos sentidos:
 * en la web no existe bloqueo biométrico, y un contenedor nativo antiguo sin la
 * marca sigue protegido por la comprobación en cliente de `NativeGate`.
 */
export async function esAppNativa(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return ua.includes(NATIVE_UA_MARK);
}
