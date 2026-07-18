"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";

/** El paciente registra su estado de ánimo (1-5 + nota opcional). */
export async function addMoodEntryAction(value: number, note?: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new Error("Cuenta no vinculada.");
  if (!(value >= 1 && value <= 5)) throw new Error("Valor de ánimo no válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("mood_entries").insert({
    patient_id: patient.id,
    mood_value: value,
    note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app");
  revalidatePath("/app/diary");
}

export async function deleteMoodEntryAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("mood_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/diary");
}
