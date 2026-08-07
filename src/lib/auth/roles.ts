import type { User } from "@supabase/supabase-js";

/**
 * Roles de la aplicación. Este helper es el ÚNICO punto donde se resuelve el
 * rol: lo usan `proxy.ts`, los dos layouts de área, `/auth/confirm` y la página
 * de onboarding. Es, en la práctica, toda la autorización de la aplicación por
 * encima de la RLS.
 *
 * El rol se lee SOLO de `app_metadata`, que es de escritura exclusiva del
 * servidor (`service_role` o una función `SECURITY DEFINER`).
 *
 * NO volver a leer `user_metadata`: el propio usuario puede reescribirlo con la
 * clave anon —`supabase.auth.updateUser({ data: { role: 'professional' } })`—,
 * así que cualquier paciente podía ascenderse a profesional. Lo escribe el
 * trigger `handle_new_user` (ver 20260807120001_role_in_app_metadata.sql).
 */
export const ROLES = {
  PROFESSIONAL: "professional",
  PATIENT: "patient",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function getUserRole(user: User | null): Role | null {
  if (!user) return null;
  const raw = user.app_metadata?.role as string | undefined;
  if (raw === ROLES.PROFESSIONAL || raw === ROLES.PATIENT) return raw;
  return null;
}

/** Home según rol: profesional → /pro, paciente → /app. */
export function homePathForRole(role: Role): string {
  return role === ROLES.PROFESSIONAL ? "/pro" : "/app";
}
