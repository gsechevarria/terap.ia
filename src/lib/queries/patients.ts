import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import type { Patient, PatientStatus } from "@/lib/types";

export type PatientOverview = Pick<
  Patient,
  "id" | "full_name" | "email" | "status" | "tags"
> & {
  pendingTasks: number;
  openAlerts: number;
  nextAppointment: string | null;
  lastActivity: string | null;
};

export type PatientListFilters = {
  status?: PatientStatus | "all";
  tag?: string;
};

/**
 * Lista los pacientes del profesional actual con un resumen de estado.
 * Usa consultas agrupadas (no N+1): una por dimensión, acotadas por los ids
 * del profesional. RLS garantiza que solo se ven los propios.
 */
export async function listPatientsWithOverview(
  filters: PatientListFilters = {},
): Promise<PatientOverview[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];

  let query = supabase
    .from("patients")
    .select("id, full_name, email, status, tags")
    .eq("professional_id", pro.id);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.tag) {
    query = query.contains("tags", [filters.tag]);
  }

  const { data: patients } = await query.order("full_name", {
    ascending: true,
    nullsFirst: false,
  });
  if (!patients || patients.length === 0) return [];

  const ids = patients.map((p) => p.id);
  const nowIso = new Date().toISOString();

  const [tasksRes, completionsRes, alertsRes, apptsRes, moodsRes] =
    await Promise.all([
      supabase.from("tasks").select("id, patient_id").in("patient_id", ids),
      supabase
        .from("task_completions")
        .select("task_id, patient_id, completed_at")
        .in("patient_id", ids),
      supabase
        .from("scale_responses")
        .select("patient_id, submitted_at")
        .eq("flagged", true)
        .in("patient_id", ids),
      supabase
        .from("appointments")
        .select("patient_id, starts_at, status")
        .in("patient_id", ids)
        .gt("starts_at", nowIso)
        .in("status", ["scheduled", "confirmed"])
        .order("starts_at", { ascending: true }),
      supabase
        .from("mood_entries")
        .select("patient_id, created_at")
        .in("patient_id", ids),
    ]);

  const completedTaskIds = new Set(
    (completionsRes.data ?? []).map((c) => c.task_id),
  );

  const pendingByPatient = new Map<string, number>();
  for (const t of tasksRes.data ?? []) {
    if (!completedTaskIds.has(t.id)) {
      pendingByPatient.set(
        t.patient_id,
        (pendingByPatient.get(t.patient_id) ?? 0) + 1,
      );
    }
  }

  const alertsByPatient = new Map<string, number>();
  for (const a of alertsRes.data ?? []) {
    alertsByPatient.set(a.patient_id, (alertsByPatient.get(a.patient_id) ?? 0) + 1);
  }

  const nextApptByPatient = new Map<string, string>();
  for (const ap of apptsRes.data ?? []) {
    // Ya vienen ordenadas ascendente: la primera por paciente es la próxima.
    if (!nextApptByPatient.has(ap.patient_id)) {
      nextApptByPatient.set(ap.patient_id, ap.starts_at);
    }
  }

  const lastActivityByPatient = new Map<string, string>();
  const trackActivity = (patientId: string, iso: string | null) => {
    if (!iso) return;
    const current = lastActivityByPatient.get(patientId);
    if (!current || iso > current) lastActivityByPatient.set(patientId, iso);
  };
  for (const c of completionsRes.data ?? []) trackActivity(c.patient_id, c.completed_at);
  for (const m of moodsRes.data ?? []) trackActivity(m.patient_id, m.created_at);

  return patients.map((p) => ({
    ...p,
    pendingTasks: pendingByPatient.get(p.id) ?? 0,
    openAlerts: alertsByPatient.get(p.id) ?? 0,
    nextAppointment: nextApptByPatient.get(p.id) ?? null,
    lastActivity: lastActivityByPatient.get(p.id) ?? null,
  }));
}

/** Recupera el conjunto de etiquetas usadas por los pacientes del profesional. */
export async function listPatientTags(): Promise<string[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await supabase
    .from("patients")
    .select("tags")
    .eq("professional_id", pro.id);
  const set = new Set<string>();
  for (const row of data ?? []) for (const t of row.tags ?? []) set.add(t);
  return [...set].sort();
}

/** Ficha del paciente (RLS garantiza pertenencia al profesional actual). */
export async function getPatient(id: string): Promise<Patient | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}
