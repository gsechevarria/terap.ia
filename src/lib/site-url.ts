/**
 * URL pública del despliegue, sin barra final.
 *
 * Se lee de la configuración y NUNCA de las cabeceras de la petición:
 * `x-forwarded-host` lo controla quien llama si el origen es alcanzable
 * directamente, y con él se fabricaba un enlace de invitación apuntando al
 * dominio del atacante (con el token dentro).
 *
 * Orden: `NEXT_PUBLIC_SITE_URL` (la canónica, configúrala en Vercel) →
 * `VERCEL_PROJECT_PRODUCTION_URL` (la inyecta Vercel) → localhost en desarrollo.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
