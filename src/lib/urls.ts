import "server-only";

/**
 * URLs absolutas de los enlaces que viajan por correo.
 *
 * Se construyen SIEMPRE desde `NEXT_PUBLIC_SITE_URL` y nunca desde las
 * cabeceras de la petición: `x-forwarded-host` lo controla quien llama, así que
 * derivar de ahí permitiría que una petición manipulada generase un enlace de
 * invitación apuntando a un dominio ajeno y se llevase el token.
 *
 * En producción se exige HTTPS. En local se admite `http://localhost`, que es
 * donde de verdad hace falta.
 */
function baseUrl(): string {
  const bruta = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!bruta) {
    throw new Error(
      "Falta NEXT_PUBLIC_SITE_URL: los enlaces de invitación no pueden construirse sin dominio configurado.",
    );
  }
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL no es una URL válida: ${bruta}`);
  }
  const esLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !esLocal) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL debe usar HTTPS fuera de local: un enlace de invitación por HTTP viaja en claro.",
    );
  }
  return url.origin;
}

/** Enlace de activación del paciente. El token va en el path, no en la query. */
export function urlDeInvitacionPaciente(token: string): string {
  return `${baseUrl()}/invitacion/${encodeURIComponent(token)}`;
}

/** Enlace de incorporación de un profesional a un centro. */
export function urlDeInvitacionProfesional(token: string): string {
  return `${baseUrl()}/unirse/${encodeURIComponent(token)}`;
}
