"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";
import { enqueuePatientNotification } from "@/lib/notifications";

/** El profesional activa una escala para su paciente (opt-in). */
export async function createScaleAssignmentAction(input: {
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

  const { data: patient } = await supabase
    .from("patients")
    .select("user_id")
    .eq("id", input.patientId)
    .maybeSingle();
  if (patient?.user_id) {
    await enqueuePatientNotification(supabase, {
      userId: patient.user_id,
      professionalId: pro.id,
      patientId: input.patientId,
      type: "new_scale",
      title: "Nuevo cuestionario",
      body: "Tu profesional te ha asignado un cuestionario para responder.",
      payload: { kind: "scale" },
    });
  }
  revalidatePath(`/pro/patients/${input.patientId}`);
}

/** Activa o desactiva una asignación (sin borrar el histórico de respuestas). */
export async function setScaleAssignmentActiveAction(
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
  if (!data) throw new Error("Escala no encontrada.");
  revalidatePath(`/pro/patients/${patientId}`);
}
