/** CSP compartida por las respuestas estáticas y el proxy con nonce por petición. */
export function contentSecurityPolicy(nonce?: string): string {
  const development = process.env.NODE_ENV === "development";
  const origin = (value?: string) => {
    try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.origin : ""; }
    catch { return ""; }
  };
  const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const sentry = origin(process.env.NEXT_PUBLIC_SENTRY_DSN);
  return [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}' 'strict-dynamic'` : ""}${development ? " 'unsafe-eval'" : ""}`,
    // React y los gráficos usan atributos style; los scripts sí exigen nonce.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    `media-src 'self' blob: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")} ${sentry}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "worker-src 'self'", "frame-ancestors 'none'", "form-action 'self'", "base-uri 'self'", "object-src 'none'",
    ...(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
