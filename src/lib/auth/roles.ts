import type { User } from "@supabase/supabase-js";

/**
 * Roles de la aplicación. Este helper es el ÚNICO punto donde se resuelve el
 * rol: lo usan `proxy.ts`, los layouts de área, `/auth/confirm` y el registro.
 *
 * El rol se lee SOLO de `app_metadata`, que es de escritura exclusiva del
 * servidor (`service_role` o una función `SECURITY DEFINER`).
 *
 * NO volver a leer `user_metadata`: el propio usuario puede reescribirlo con la
 * clave anon —`supabase.auth.updateUser({ data: { role } })`—, así que
 * cualquier paciente podía ascenderse a profesional.
 *
 * ---------------------------------------------------------------------------
 * ESTO NO ES EL CONTEXTO DE TRABAJO, y la diferencia importa.
 *
 * `app_metadata.role` dice qué PUEDE llegar a hacer la cuenta. Dónde está
 * trabajando ahora mismo lo dicen los datos: sus membresías de organización y
 * sus expedientes. Una misma persona puede ser profesional en un centro y
 * paciente en otro, y entonces elige explícitamente (ver `queries/contexts.ts`
 * y `/contexto`). Por eso `professional` NO implica "no es paciente".
 * ---------------------------------------------------------------------------
 */
export const ROLES = {
  PROFESSIONAL: "professional",
  /**
   * Alta profesional enviada y pendiente de revisión. Puede consultar su
   * estado y poco más: ni datos clínicos, ni invitar. Lo escribe
   * `register_professional`, y solo `admin_review_professional` lo asciende.
   */
  PROFESSIONAL_PENDING: "professional_pending",
  PATIENT: "patient",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const VALIDOS = new Set<string>(Object.values(ROLES));

export function getUserRole(user: User | null): Role | null {
  if (!user) return null;
  const raw = user.app_metadata?.role as string | undefined;
  return raw && VALIDOS.has(raw) ? (raw as Role) : null;
}

/** Home por rol. El pendiente aterriza en su estado, no en el panel. */
export function homePathForRole(role: Role): string {
  if (role === ROLES.PROFESSIONAL) return "/pro";
  if (role === ROLES.PROFESSIONAL_PENDING) return "/registro/estado";
  return "/app";
}

/** ¿El rol da acceso al panel profesional? Solo el aprobado. */
export function puedeEntrarAlPanel(role: Role | null): boolean {
  return role === ROLES.PROFESSIONAL;
}
