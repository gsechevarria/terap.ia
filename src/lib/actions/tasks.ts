"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";

export async function createTaskAction(input: {
  patientId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
}) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

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

export async function updateTaskAction(input: {
  taskId: string;
  patientId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description: input.description?.trim() || null,
      due_date: input.dueDate || null,
    })
    .eq("id", input.taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${input.patientId}`);
}

export async function deleteTaskAction(taskId: string, patientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}
