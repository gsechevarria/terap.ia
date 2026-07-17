import { createClient } from "@/lib/supabase/server";
import type { Professional } from "@/lib/types";

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
