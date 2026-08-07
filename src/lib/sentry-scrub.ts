import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Depuración de PII antes de enviar NADA a Sentry.
 *
 * Esto no es opcional: el producto maneja datos del art. 9 RGPD (salud mental).
 * Un evento de error puede arrastrar nombres de pacientes, correos, notas
 * clínicas, respuestas de escalas e importes, y enviarlos a un tercero sería
 * una comunicación de datos sin base jurídica.
 *
 * Se usa una LISTA BLANCA, no una lista negra: lo que no está explícitamente
 * permitido se elimina. Una lista negra falla en cuanto alguien añade un campo
 * nuevo y se olvida de incluirlo.
 */

/** Claves de contexto que sí pueden viajar (nunca contienen datos personales). */
const CAMPOS_PERMITIDOS = new Set([
  "route",
  "method",
  "statusCode",
  "digest",
  "runtime",
  "environment",
  "release",
  "transaction",
  "componentStack",
  "mechanism",
  "handled",
  "type",
]);

/** Parámetros de consulta que pueden llevar secretos o identificadores. */
const QUERY_PROHIBIDA = /(token|secret|code|email|path|patient|q)=/i;

/** Sustituye los UUID y los correos que puedan colarse en un texto libre. */
export function scrubText(input: string): string {
  return input
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<uuid>",
    )
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>");
}

/** Deja la URL sin query string ni segmentos identificables. */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "https://placeholder.invalid");
    const path = scrubText(u.pathname);
    return QUERY_PROHIBIDA.test(u.search) || u.search
      ? `${path}?<oculto>`
      : path;
  } catch {
    return "<url no analizable>";
  }
}

function filtrarObjeto(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!CAMPOS_PERMITIDOS.has(k)) continue;
    out[k] = typeof v === "string" ? scrubText(v) : v;
  }
  return out;
}

export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  // Nunca el usuario, ni siquiera el id: identifica a un paciente concreto.
  delete event.user;
  delete event.server_name;

  if (event.request) {
    event.request = {
      method: event.request.method,
      url: event.request.url ? scrubUrl(event.request.url) : undefined,
      // Ni cabeceras, ni cookies, ni cuerpo: los tres pueden llevar la sesión.
    };
  }

  event.extra = filtrarObjeto(event.extra as Record<string, unknown>);
  event.contexts = filtrarObjeto(
    event.contexts as unknown as Record<string, unknown>,
  ) as ErrorEvent["contexts"];

  // Los mensajes de error de Postgres suelen incluir el valor que ha fallado.
  if (event.exception?.values) {
    for (const v of event.exception.values) {
      if (v.value) v.value = scrubText(v.value);
    }
  }
  if (event.message) event.message = scrubText(event.message);

  // Las migas de pan registran navegación y peticiones: se limpian igual.
  event.breadcrumbs = event.breadcrumbs?.map((b) => ({
    ...b,
    message: b.message ? scrubText(b.message) : undefined,
    data: filtrarObjeto(b.data),
  }));

  return event;
}

/** Opciones comunes a los tres runtimes (cliente, servidor y edge). */
export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sin DSN, `init` no envía nada: en desarrollo queda desactivado solo.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  // `false` explícito: por defecto Sentry adjunta IP y cabeceras.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend,
};
