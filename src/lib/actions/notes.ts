"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";

export async function addNoteAction(patientId: string, body: string) {
  const { pro } = await requireOwnedPatient(patientId);
  const text = body.trim();
  if (!text) throw new Error("La nota está vacía.");

  const supabase = await createClient();
  const { error } = await supabase.from("patient_notes").insert({
    professional_id: pro.id,
    patient_id: patientId,
    body: text,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function deleteNoteAction(noteId: string, patientId: string) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_notes")
    .delete()
    .eq("id", noteId)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}
