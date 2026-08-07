"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient, requireOwnedPatient } from "@/lib/queries/identity";
import { getScaleForForm } from "@/lib/queries/scales";
import type { ScaleAnswers } from "@/lib/scales";

type SubmitResult =
  | { ok: true; flagged: boolean }
  | { ok: false; error: string };

/** Traduce los errores del trigger `compute_scale_response`. */
function scaleError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "P0010":
      return "Faltan respuestas. Responde todas las preguntas antes de enviar.";
    case "P0011":
      return "Alguna respuesta está fuera de las opciones válidas.";
    case "P0012":
      return "El envío no corresponde a este cuestionario.";
    default:
      return "No hemos podido guardar tus respuestas. Inténtalo de nuevo.";
  }
}

/**
 * El paciente envía su respuesta a una escala. La puntuación, severidad y el
 * flag (p. ej. PHQ-9 ítem 9) los calcula el trigger de la BD.
 * RLS exige una asignación activa (refuerzo del opt-in).
 *
 * VALIDACIÓN DE SERVIDOR (ago 2026): antes se insertaba `input.answers` tal
 * cual. Una server action es un endpoint HTTP, así que un POST con
 * `{"1":0,"2":0,"3":0}` sobre un PHQ-9 generaba score 0 / severidad "Mínima":
 * un registro clínico que afirma depresión mínima a partir de 3 de 9 ítems,
 * indistinguible de uno válido en la gráfica y en la analítica agregada. Y si
 * faltaba el ítem 9, `flagged` salía false: el envío incompleto OCULTABA la
 * ideación suicida.
 *
 * Se valida aquí (mensaje claro) y también en el trigger (barrera real, cubre
 * cualquier ruta de inserción).
 */
export async function submitScaleResponseAction(input: {
  assignmentId: string;
  scaleId: string;
  answers: ScaleAnswers;
}): Promise<SubmitResult> {
  const patient = await getCurrentPatient();
  if (!patient) return { ok: false, error: "Cuenta no vinculada." };

  const scale = await getScaleForForm(input.scaleId);
  if (!scale) return { ok: false, error: "Escala no encontrada." };

  const valid = new Set(scale.definition.options.map((o) => o.value));
  const ids = scale.definition.items.map((i) => String(i.id));
  const keys = Object.keys(input.answers ?? {});

  const completa =
    keys.length === ids.length &&
    ids.every((id) => {
      const v = input.answers[id];
      return v != null && Number.isInteger(v) && valid.has(v);
    });

  if (!completa) {
    return {
      ok: false,
      error: "Responde todas las preguntas antes de enviar.",
    };
  }

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
  if (error) return { ok: false, error: scaleError(error) };

  revalidatePath("/app");
  return { ok: true, flagged: !!data.flagged };
}

/**
 * El profesional marca como vista una respuesta con el ítem de riesgo.
 *
 * Sin acuse, el contador de alertas de la ficha es un recuento histórico que
 * nunca vuelve a cero y deja de servir como señal.
 */
export async function acknowledgeFlaggedResponseAction(
  responseId: string,
  patientId: string,
) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scale_responses")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: pro.id,
    })
    .eq("id", responseId)
    .eq("patient_id", patientId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Respuesta no encontrada.");

  revalidatePath("/pro");
  revalidatePath(`/pro/patients/${patientId}`);
}
