import type { User } from "@supabase/supabase-js";

/**
 * Roles de la aplicación.
 *
 * SESIÓN 0 (bootstrap): el rol vive en el metadata del usuario de Supabase Auth.
 * Se fija en el PRIMER acceso vía `signInWithOtp({ options: { data: { role } } })`
 * (los datos de `data` solo se aplican al crear el usuario; en accesos posteriores
 * el rol ya fijado no cambia).
 *
 * SESIÓN 1: el rol pasará a la tabla `profiles` con RLS y dejará de leerse del
 * metadata. Este helper es el ÚNICO punto donde se resuelve el rol, para poder
 * migrar la fuente sin tocar el resto del código.
 */
export const ROLES = {
  PROFESSIONAL: "professional",
  PATIENT: "patient",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function getUserRole(user: User | null): Role | null {
  if (!user) return null;
  const raw = (user.app_metadata?.role ?? user.user_metadata?.role) as
    | string
    | undefined;
  if (raw === ROLES.PROFESSIONAL || raw === ROLES.PATIENT) return raw;
  return null;
}

/** Home según rol: profesional → /pro, paciente → /app. */
export function homePathForRole(role: Role): string {
  return role === ROLES.PROFESSIONAL ? "/pro" : "/app";
}
