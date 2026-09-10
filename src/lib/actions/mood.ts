"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { todayYMD } from "@/lib/tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";

/** El paciente registra su estado de ánimo (1-5 + nota opcional). */
async function addMoodEntryActionImpl(value: number, note?: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");
  if (!(Number.isInteger(value) && value >= 1 && value <= 5)) throw new ActionInputError("Valor de ánimo no válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("mood_entries").upsert({
    entry_date: todayYMD(),
    patient_id: patient.id,
    mood_value: value,
    note: note?.trim().slice(0, 5000) || null,
  }, { onConflict: "patient_id,entry_date" });
  if (error) throw new Error(error.message);
  revalidatePath("/app");
  revalidatePath("/app/diary");
}

async function deleteMoodEntryActionImpl(id: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("mood_entries")
    .delete()
    .eq("id", id)
    .eq("patient_id", patient.id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/diary");
}

export async function addMoodEntryAction(...args: Parameters<typeof addMoodEntryActionImpl>) { return runAction(() => addMoodEntryActionImpl(...args)); }

export async function deleteMoodEntryAction(...args: Parameters<typeof deleteMoodEntryActionImpl>) { return runAction(() => deleteMoodEntryActionImpl(...args)); }
