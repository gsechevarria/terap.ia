/**
 * Traducción de los errores que pueden llegar a la interfaz.
 *
 * Supabase responde en inglés y con jerga propia ("Email rate limit exceeded",
 * "Invalid login credentials"), que no se puede enseñar tal cual a un usuario
 * español. Se mapean por `code` —estable— y no por el texto del mensaje, que
 * cambia entre versiones de GoTrue.
 */

/** Fallback accionable: dice qué hacer y tranquiliza sobre lo ya escrito. */
export const GENERIC_ERROR =
  "No hemos podido guardar los cambios. Revisa tu conexión e inténtalo de nuevo; tus datos siguen en el formulario.";

const AUTH_MESSAGES: Record<string, string> = {
  over_email_send_rate_limit:
    "Se han enviado demasiados correos seguidos a esta dirección. Espera unos minutos antes de volver a intentarlo.",
  over_request_rate_limit:
    "Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.",
  invalid_credentials: "El correo o la contraseña no son correctos.",
  weak_password:
    "La contraseña es demasiado débil. Usa al menos 8 caracteres, combinando letras y números.",
  email_address_invalid: "Esa dirección de correo no es válida.",
  email_exists: "Ya existe una cuenta con ese correo.",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  same_password: "La contraseña nueva debe ser distinta de la actual.",
  otp_expired:
    "El enlace ha caducado o ya se ha usado. Pide uno nuevo desde la pantalla de acceso.",
  session_expired: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
  email_not_confirmed:
    "Tienes que confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.",
};

/** Extrae el `code` de un error de Supabase sin asumir su forma exacta. */
function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Error de Supabase Auth → mensaje en español. Cualquier código no contemplado
 * cae en el genérico: es preferible a filtrar texto en inglés a la interfaz.
 */
export function authErrorMessage(error: unknown): string {
  const code = codeOf(error);
  return (code && AUTH_MESSAGES[code]) || GENERIC_ERROR;
}

/**
 * Error lanzado por una server action → mensaje mostrable.
 *
 * Las actions de este repo lanzan sus propias validaciones ya en español
 * ("Categoría no válida."), así que se respetan; lo que se sustituye es el
 * fallback, que hasta ahora era el literal "Error." y no le decía nada al
 * usuario. Los errores de Supabase que se cuelen se mapean por código.
 */
export function actionErrorMessage(error: unknown): string {
  const code = codeOf(error);
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (error instanceof Error && error.message.trim()) return error.message;
  return GENERIC_ERROR;
}
