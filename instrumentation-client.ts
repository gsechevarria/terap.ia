import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry-scrub";

/**
 * Sentry en el navegador.
 *
 * Session Replay y captura de `console` están DESACTIVADOS a propósito: en esta
 * aplicación grabarían la pantalla de un paciente respondiendo un PHQ-9.
 */
Sentry.init({
  ...sentryBaseOptions,
  integrations: [],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
