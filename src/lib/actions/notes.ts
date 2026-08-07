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
  // `.select().maybeSingle()`: en PostgREST un UPDATE/DELETE que no casa
  // ninguna fila devuelve `error: null`, así que la UI cerraba el editor,
  // refrescaba y mostraba los datos antiguos como si se hubieran guardado.
  const { data, error } = await supabase
    .from("patient_notes")
    .delete()
    .eq("id", noteId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nota no encontrada.");
  revalidatePath(`/pro/patients/${patientId}`);
}
