import { todayYMD } from "@/lib/tz";
import { checked, allRows } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/schemas/common";
import { getCurrentPatient } from "@/lib/queries/identity";
import type { DocumentRow, MoodEntry, ResourceRow } from "@/lib/types";

/** Diario emocional del paciente actual (histórico). */
export async function getMyMoodEntries(): Promise<MoodEntry[]> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return [];
  const { data } = await allRows(supabase
    .from("mood_entries")
    .select("*")
    .eq("patient_id", patient.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false }));
  return data ?? [];
}

/**
 * Recursos gestionables por el profesional para un paciente (suyos + generales).
 *
 * `patientId` se valida como UUID antes de interpolarlo: llega del segmento de
 * URL y en un `.or()` de PostgREST las comas y los paréntesis son sintaxis, así
 * que un segmento manipulado podía reescribir el filtro y romper el aislamiento
 * entre pacientes del mismo profesional. (El mismo cuidado que ya tenía
 * `sanitizeSearch` en `queries/patients.ts`.)
 */
export async function getProfessionalResources(
  patientId: string,
): Promise<ResourceRow[]> {
  if (!isUuid(patientId)) return [];
  const supabase = await createClient();
  const { data } = await allRows(supabase
    .from("resources")
    .select("*")
    .or(`patient_id.eq.${patientId},patient_id.is.null`)
    .order("created_at", { ascending: false }));
  return data ?? [];
}

/** Recursos visibles para el paciente actual (suyos + generales de su profesional). */
export async function getMyResources(): Promise<ResourceRow[]> {
  const supabase = await createClient();
  const { data } = await allRows(supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false }));
  return data ?? [];
}

/** Documentos del paciente actual. */
export async function getMyDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return [];
  const { data } = await allRows(supabase
    .from("documents")
    .select("*")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false }));
  return data ?? [];
}

export async function getMyMoodToday() {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return null;
  const { data } = await checked(supabase.from("mood_entries").select("mood_value,note").eq("patient_id", patient.id).eq("entry_date", todayYMD()).maybeSingle());
  return data;
}
