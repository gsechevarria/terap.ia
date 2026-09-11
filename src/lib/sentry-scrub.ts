import type { ErrorEvent } from "@sentry/nextjs";

/** El texto libre no es una fuente admisible de telemetría. */
export function scrubText(_input: string): string { void _input; return "[contenido omitido]"; }
const ROUTE_PARTS = new Set(["app","pro","auth","login","onboarding","invite","patients","appointments","account","password","settings","ajustes","scales","diary","resources","payments","pagos","contabilidad","export","ics","api","cron","notifications"]);
export function scrubUrl(value: string): string {
  try {
    const url = new URL(value, "https://placeholder.invalid");
    return url.pathname.split("/").map(p => !p || ROUTE_PARTS.has(p) ? p : "[segmento]").join("/");
  } catch { return "[ruta]"; }
}
export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  // Construir un evento nuevo evita filtrar por accidente nuevas propiedades del SDK.
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: "javascript",
    message: "Error de aplicación",
    request: event.request ? { url: event.request.url ? scrubUrl(event.request.url) : undefined } : undefined,
    exception: event.exception?.values ? { values: event.exception.values.map(e => ({
      type: "Error", value: "Contenido omitido por privacidad",
      stacktrace: e.stacktrace ? { frames: e.stacktrace.frames?.map(f => ({
        filename: f.filename ? scrubUrl(f.filename) : undefined,
        lineno: f.lineno, colno: f.colno, in_app: f.in_app,
      })) } : undefined,
    })) } : undefined,
  };
}
export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSendTransaction: () => null,
  beforeSend,
};
