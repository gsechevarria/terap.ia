import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import type { ScaleAnswers, ScaleDefinition } from "@/lib/scales";

export type CatalogScale = { id: string; code: string; name: string };

/** Catálogo de escalas activas (para el selector de activación). */
export async function getScaleCatalog(): Promise<CatalogScale[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scales")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code", { ascending: true });
  return data ?? [];
}

export type ScaleForForm = {
  id: string;
  code: string;
  name: string;
  definition: ScaleDefinition;
};

/** Escala + definición para renderizar el formulario. */
export async function getScaleForForm(
  scaleId: string,
): Promise<ScaleForForm | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scales")
    .select("id, code, name, definition")
    .eq("id", scaleId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    definition: data.definition as unknown as ScaleDefinition,
  };
}

export type ScaleResponseRow = {
  id: string;
  score: number | null;
  severity: string | null;
  flagged: boolean;
  submitted_at: string;
  answers: ScaleAnswers;
};

export type AssignmentDetail = {
  id: string;
  patientId: string;
  assignmentType: string;
  active: boolean;
  scaleCode: string;
  scaleName: string;
  definition: ScaleDefinition;
  responses: ScaleResponseRow[];
};

/** Detalle de una asignación (profesional): escala + histórico de respuestas. */
export async function getAssignmentDetail(
  assignmentId: string,
): Promise<AssignmentDetail | null> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("scale_assignments")
    .select(
      "id, patient_id, assignment_type, active, scales(code, name, definition)",
    )
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a) return null;

  const { data: responses } = await supabase
    .from("scale_responses")
    .select("id, score, severity, flagged, submitted_at, answers")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: true });

  const scale = a.scales as unknown as {
    code: string;
    name: string;
    definition: ScaleDefinition;
  };

  return {
    id: a.id,
    patientId: a.patient_id,
    assignmentType: a.assignment_type,
    active: a.active,
    scaleCode: scale.code,
    scaleName: scale.name,
    definition: scale.definition,
    responses: (responses ?? []) as unknown as ScaleResponseRow[],
  };
}

/** Nº de respuestas con ítem de riesgo marcado (para alertas en la ficha). */
export async function getFlaggedCountForPatient(
  patientId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("scale_responses")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("flagged", true);
  return count ?? 0;
}

export type MyAssignment = {
  id: string;
  scaleId: string;
  assignmentType: string;
  code: string;
  name: string;
};

/** Escalas activas del paciente actual (opt-in: solo las activadas). */
export async function getMyActiveAssignments(): Promise<MyAssignment[]> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return [];
  const { data } = await supabase
    .from("scale_assignments")
    .select("id, scale_id, assignment_type, scales(code, name)")
    .eq("patient_id", patient.id)
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data ?? []).map((a) => {
    const s = a.scales as unknown as { code: string; name: string };
    return {
      id: a.id,
      scaleId: a.scale_id,
      assignmentType: a.assignment_type,
      code: s?.code ?? "?",
      name: s?.name ?? "?",
    };
  });
}

export type PatientAssignmentForm = {
  id: string;
  scaleId: string;
  scaleCode: string;
  scaleName: string;
  definition: ScaleDefinition;
};

/** Asignación activa del paciente para responder (valida pertenencia por RLS). */
export async function getAssignmentForPatient(
  assignmentId: string,
): Promise<PatientAssignmentForm | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scale_assignments")
    .select("id, active, scale_id, scales(code, name, definition)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!data || !data.active) return null;
  const scale = data.scales as unknown as {
    code: string;
    name: string;
    definition: ScaleDefinition;
  };
  return {
    id: data.id,
    scaleId: data.scale_id,
    scaleCode: scale.code,
    scaleName: scale.name,
    definition: scale.definition,
  };
}
