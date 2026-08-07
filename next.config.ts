import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad.
 *
 * Antes no había ninguna: sin CSP cualquier XSS futuro se convierte en
 * exfiltración libre de datos de salud; sin `frame-ancestors` cabe clickjacking
 * sobre "Eliminar paciente" o sobre el botón de consentimiento del onboarding;
 * sin `Referrer-Policy`, las URLs `/invite/<token>` llevan el secreto en el path
 * y viajaban en el `Referer` a cualquier recurso externo.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' es necesario mientras Next inyecte los scripts de arranque
  // sin nonce. Endurecer con nonce en una iteración posterior (requiere mover
  // las cabeceras a `proxy.ts` para generar uno por petición).
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // `blob:` lo usan las descargas de export (XLSX/PDF); `data:` los iconos.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Supabase: REST y Storage por HTTPS, Realtime por WSS.
  `connect-src 'self' ${supabaseUrl} https://*.supabase.co wss://*.supabase.co`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
