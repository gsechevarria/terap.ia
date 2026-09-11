"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";

/** El profesional activa una escala para su paciente (opt-in). */
async function createScaleAssignmentActionImpl(input: {
  patientId: string;
  scaleId: string;
  type: "one_off" | "recurring";
  intervalDays?: number | null;
}) {
  const { pro } = await requireOwnedPatient(input.patientId);

  const supabase = await createClient();
  const { error } = await supabase.from("scale_assignments").insert({
    professional_id: pro.id,
    patient_id: input.patientId,
    scale_id: input.scaleId,
    assignment_type: input.type,
    recurrence_interval_days:
      input.type === "recurring" ? (input.intervalDays ?? 14) : null,
    active: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/pro/patients/${input.patientId}`);
}

/** Activa o desactiva una asignación (sin borrar el histórico de respuestas). */
async function setScaleAssignmentActiveActionImpl(
  assignmentId: string,
  patientId: string,
  active: boolean,
) {
  const { pro } = await requireOwnedPatient(patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scale_assignments")
    .update({ active })
    .eq("id", assignmentId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Escala no encontrada.");
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function createScaleAssignmentAction(...args: Parameters<typeof createScaleAssignmentActionImpl>) { return runAction(() => createScaleAssignmentActionImpl(...args)); }

export async function setScaleAssignmentActiveAction(...args: Parameters<typeof setScaleAssignmentActiveActionImpl>) { return runAction(() => setScaleAssignmentActiveActionImpl(...args)); }
