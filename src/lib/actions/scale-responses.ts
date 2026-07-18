"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import type { ScaleAnswers } from "@/lib/scales";

type SubmitResult =
  | { ok: true; flagged: boolean }
  | { ok: false; error: string };

/**
 * El paciente envía su respuesta a una escala. La puntuación, severidad y el
 * flag (p. ej. PHQ-9 ítem 9) los calcula el trigger de la BD.
 * RLS exige una asignación activa (refuerzo del opt-in).
 */
export async function submitScaleResponseAction(input: {
  assignmentId: string;
  scaleId: string;
  answers: ScaleAnswers;
}): Promise<SubmitResult> {
  const patient = await getCurrentPatient();
  if (!patient) return { ok: false, error: "Cuenta no vinculada." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scale_responses")
    .insert({
      assignment_id: input.assignmentId,
      patient_id: patient.id,
      scale_id: input.scaleId,
      answers: input.answers,
    })
    .select("flagged")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app");
  return { ok: true, flagged: !!data.flagged };
}
