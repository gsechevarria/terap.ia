import { ActionInputError } from "@/lib/action-result";
import { getUserRole } from "@/lib/auth/roles";
import { checked } from "@/lib/query-result";
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
  if (!user || getUserRole(user) !== "professional") return null;

  const { data } = await checked(supabase
    .from("professionals")
    .select("id, user_id, full_name, email")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle());

  return data ?? null;
}

/**
 * Devuelve la fila `patients` vinculada al usuario autenticado, o null si el
 * usuario aún no ha aceptado ninguna invitación.
 *
 * Una misma cuenta puede tener expediente en dos consultas (organizaciones,
 * 16-sep). Antes esto era un `.maybeSingle()` sobre `user_id`, que con dos
 * filas da error y tumbaba TODA la app del paciente (hallazgo H4). Ahora se
 * usa el mismo expediente al que van las escrituras del paciente:
 * `current_patient_id()`, el activo y consentido más antiguo. Así lo que el
 * paciente lee y lo que escribe nunca caen en expedientes distintos. Si no
 * hay ninguno así (archivado, consentimiento pendiente), se devuelve la fila
 * más antigua, como hacía la versión anterior con una sola fila: el layout
 * decide qué hacer con ella.
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

  const { data: vigente } = await checked(supabase.rpc("current_patient_id"));
  let query = supabase
    .from("patients")
    .select("id, professional_id, full_name, user_id")
    .eq("user_id", user.id);
  query = vigente
    ? query.eq("id", vigente)
    : query.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1);
  const { data } = await checked(query.maybeSingle());

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
  if (!pro) throw new ActionInputError("No autenticado.");
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
  if (!patientId) throw new ActionInputError("Falta el paciente.");

  const supabase = await createClient();
  const { data } = await checked(supabase
    .from("patients")
    .select("id, email, user_id, full_name")
    .eq("id", patientId)
    // Sin `professional_id = pro.id`: la RLS de `patients` ya limita a los
    // expedientes con asignación clínica viva. Con ese filtro, el colaborador
    // asignado en un centro abría la ficha y no podía crear ni una tarea
    // («Paciente no encontrado»). Hallazgo H3.
    .maybeSingle());

  if (!data) throw new ActionInputError("Paciente no encontrado.");
  return { pro, patient: data };
}
