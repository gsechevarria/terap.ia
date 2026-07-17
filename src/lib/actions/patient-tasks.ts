"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";

/** El paciente marca una tarea como hecha, con texto libre opcional. */
export async function completeTaskAction(taskId: string, responseText?: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new Error("Cuenta no vinculada.");

  const supabase = await createClient();
  const { error } = await supabase.from("task_completions").insert({
    task_id: taskId,
    patient_id: patient.id,
    response_text: responseText?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app");
}
