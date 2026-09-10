import { contentSecurityPolicy } from "./src/lib/csp";
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

const csp = contentSecurityPolicy();

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
