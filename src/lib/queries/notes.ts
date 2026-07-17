import { createClient } from "@/lib/supabase/server";
import type { PatientNote } from "@/lib/types";

/** Notas rápidas del profesional sobre el paciente (más recientes primero). */
export async function getNotesForPatient(
  patientId: string,
): Promise<PatientNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_notes")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
