import { createClient } from "@/lib/supabase/server";
import type { Patient, Professional } from "@/lib/types";

/**
 * Devuelve la fila `professionals` del usuario autenticado, o null.
 * Punto único de resolución de identidad profesional (no hacer lookups sueltos).
 */
export async function getCurrentProfessional(): Promise<Pick<
  Professional,
  "id" | "user_id" | "full_name" | "email"
> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("professionals")
    .select("id, user_id, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}

/**
 * Devuelve la fila `patients` vinculada al usuario autenticado, o null si el
 * usuario aún no ha aceptado ninguna invitación.
 */
export async function getCurrentPatient(): Promise<Pick<
  Patient,
  "id" | "professional_id" | "full_name" | "user_id"
> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("patients")
    .select("id, professional_id, full_name, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}
