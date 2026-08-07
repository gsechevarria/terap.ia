import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry-scrub";

/**
 * Inicialización de Sentry en servidor y edge.
 *
 * Sin `NEXT_PUBLIC_SENTRY_DSN` queda desactivado (`enabled: false`), así que en
 * desarrollo no envía nada. Toda la depuración de PII vive en
 * `lib/sentry-scrub.ts`: no repliques configuración aquí.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(sentryBaseOptions);
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryBaseOptions);
  }
}

/**
 * Captura los errores de renderizado en servidor (Next 15+).
 * El `digest` es lo único que se enseña al usuario en `error.tsx`, así que es
 * la pieza que permite cruzar un informe con su evento.
 */
export const onRequestError = Sentry.captureRequestError;
