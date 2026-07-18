"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";

/** El profesional activa una escala para su paciente (opt-in). */
export async function createScaleAssignmentAction(input: {
  patientId: string;
  scaleId: string;
  type: "one_off" | "recurring";
  intervalDays?: number | null;
}) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");

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
export async function setScaleAssignmentActiveAction(
  assignmentId: string,
  patientId: string,
  active: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scale_assignments")
    .update({ active })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}
