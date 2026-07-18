import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import type { DocumentRow, MoodEntry, ResourceRow } from "@/lib/types";

/** Diario emocional del paciente actual (histórico). */
export async function getMyMoodEntries(): Promise<MoodEntry[]> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return [];
  const { data } = await supabase
    .from("mood_entries")
    .select("*")
    .eq("patient_id", patient.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Recursos gestionables por el profesional para un paciente (suyos + generales). */
export async function getProfessionalResources(
  patientId: string,
): Promise<ResourceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select("*")
    .or(`patient_id.eq.${patientId},patient_id.is.null`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Recursos visibles para el paciente actual (suyos + generales de su profesional). */
export async function getMyResources(): Promise<ResourceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Documentos del paciente actual. */
export async function getMyDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return [];
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}
