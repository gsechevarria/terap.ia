"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";

/** El paciente marca una tarea como hecha, con texto libre opcional. */
async function completeTaskActionImpl(taskId: string, responseText?: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_patient_task", {
    p_id: taskId, p_response: responseText?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app");
}

export async function completeTaskAction(...args: Parameters<typeof completeTaskActionImpl>) { return runAction(() => completeTaskActionImpl(...args)); }
