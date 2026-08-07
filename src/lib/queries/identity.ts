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

export type OwnedPatient = {
  id: string;
  email: string | null;
  user_id: string | null;
  full_name: string | null;
};

/**
 * Profesional autenticado, o error.
 *
 * Usarlo en toda server action del área `/pro`: las server actions son
 * endpoints HTTP públicos, invocables sin pasar por ninguna página.
 */
export async function requireProfessional(): Promise<
  NonNullable<Awaited<ReturnType<typeof getCurrentProfessional>>>
> {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
  return pro;
}

/**
 * Comprueba que `patientId` pertenece al profesional autenticado y devuelve
 * ambos. Lanza si no.
 *
 * El filtro por `professional_id` es explícito y no se apoya solo en la RLS: un
 * UUID de paciente no es un secreto (viaja como prop a componentes cliente, va
 * en la URL `/pro/patients/<uuid>` y es el primer segmento de las rutas de
 * Storage), así que cualquier action que acepte uno y no valide propiedad es
 * una referencia directa a objeto insegura.
 */
export async function requireOwnedPatient(
  patientId: string,
): Promise<{
  pro: NonNullable<Awaited<ReturnType<typeof getCurrentProfessional>>>;
  patient: OwnedPatient;
}> {
  const pro = await requireProfessional();
  if (!patientId) throw new Error("Falta el paciente.");

  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("id, email, user_id, full_name")
    .eq("id", patientId)
    .eq("professional_id", pro.id)
    .maybeSingle();

  if (!data) throw new Error("Paciente no encontrado.");
  return { pro, patient: data };
}
