"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";

async function createTaskActionImpl(input: {
  patientId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
}) {
  const { pro } = await requireOwnedPatient(input.patientId);
  const title = input.title.trim();
  if (!title) throw new ActionInputError("El título es obligatorio.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    professional_id: pro.id,
    patient_id: input.patientId,
    title,
    description: input.description?.trim() || null,
    due_date: input.dueDate || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/pro/patients/${input.patientId}`);
}

async function updateTaskActionImpl(input: {
  taskId: string;
  patientId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
}) {
  const { pro } = await requireOwnedPatient(input.patientId);
  const title = input.title.trim();
  if (!title) throw new ActionInputError("El título es obligatorio.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title,
      description: input.description?.trim() || null,
      due_date: input.dueDate || null,
    })
    .eq("id", input.taskId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Tarea no encontrada.");
  revalidatePath(`/pro/patients/${input.patientId}`);
}

async function deleteTaskActionImpl(taskId: string, patientId: string) {
  const { pro } = await requireOwnedPatient(patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Tarea no encontrada.");
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function createTaskAction(...args: Parameters<typeof createTaskActionImpl>) { return runAction(() => createTaskActionImpl(...args)); }

export async function updateTaskAction(...args: Parameters<typeof updateTaskActionImpl>) { return runAction(() => updateTaskActionImpl(...args)); }

export async function deleteTaskAction(...args: Parameters<typeof deleteTaskActionImpl>) { return runAction(() => deleteTaskActionImpl(...args)); }
