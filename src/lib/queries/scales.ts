import { assignmentIsDue } from "@/lib/assignment-due";
import { allRows, checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import type { ScaleAnswers, ScaleDefinition } from "@/lib/scales";

export type CatalogScale = { id: string; code: string; name: string };

/** Catálogo de escalas activas (para el selector de activación). */
export async function getScaleCatalog(): Promise<CatalogScale[]> {
  const supabase = await createClient();
  const { data } = await allRows(supabase
    .from("scales")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code", { ascending: true }));
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
  const { data } = await checked(supabase
    .from("scales")
    .select("id, code, name, definition")
    .eq("id", scaleId)
    .maybeSingle());
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
  const { data: a } = await checked(supabase
    .from("scale_assignments")
    .select(
      "id, patient_id, assignment_type, active, scales(code, name, definition)",
    )
    .eq("id", assignmentId)
    .maybeSingle());
  if (!a) return null;

  const { data: responses } = await allRows(supabase
    .from("scale_responses")
    .select("id, score, severity, flagged, submitted_at, answers")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: true }));

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
/**
 * Alertas de ítem de riesgo PENDIENTES de revisar por el profesional.
 *
 * Antes contaba todas las históricas, así que una vez marcada la primera el
 * contador no volvía nunca a cero y dejaba de servir como señal: el banner
 * quedaba encendido para siempre y se aprendía a ignorarlo. Ahora solo cuenta
 * las que no tienen acuse de recibo.
 */
export async function getFlaggedCountForPatient(
  patientId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await checked(supabase
    .from("scale_responses")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("flagged", true)
    .is("acknowledged_at", null));
  return count ?? 0;
}

export type FlaggedResponse = {
  id: string;
  submittedAt: string;
  scaleCode: string;
  assignmentId: string;
};

/** Respuestas con ítem de riesgo aún sin revisar, para poder darlas por vistas. */
export async function getUnacknowledgedFlagged(
  patientId: string,
): Promise<FlaggedResponse[]> {
  const supabase = await createClient();
  const { data } = await allRows(supabase
    .from("scale_responses")
    .select("id, submitted_at, assignment_id, scales(code)")
    .eq("patient_id", patientId)
    .eq("flagged", true)
    .is("acknowledged_at", null)
    .order("submitted_at", { ascending: false }));

  return (data ?? []).map((r) => {
    const rel = r as typeof r & { scales: { code: string } | null };
    return {
      id: r.id,
      submittedAt: r.submitted_at,
      scaleCode: rel.scales?.code ?? "escala",
      assignmentId: r.assignment_id,
    };
  });
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
  const { data } = await allRows(supabase
    .from("scale_assignments")
    .select("id, scale_id, assignment_type, starts_on, ends_on, active, recurrence_interval_days, scales(code, name)")
    .eq("patient_id", patient.id)
    .eq("active", true)
    .order("created_at", { ascending: false }));
  const { data: responses } = await allRows(supabase.from("scale_responses").select("assignment_id, submitted_at").eq("patient_id", patient.id));
  const latest = new Map<string, string>();
  for (const response of responses) if ((latest.get(response.assignment_id) ?? "") < response.submitted_at) latest.set(response.assignment_id, response.submitted_at);
  return (data ?? []).filter(a => assignmentIsDue(a, latest.get(a.id) ?? null)).map((a) => {
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
  if (!(await getMyActiveAssignments()).some(a => a.id === assignmentId)) return null;
  const supabase = await createClient();
  const { data } = await checked(supabase
    .from("scale_assignments")
    .select("id, active, scale_id, scales(code, name, definition)")
    .eq("id", assignmentId)
    .maybeSingle());
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
