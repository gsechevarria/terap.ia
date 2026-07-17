import { createClient } from "@/lib/supabase/server";
import type {
  Appointment,
  DocumentRow,
  MoodEntry,
  Payment,
} from "@/lib/types";

export type ScaleAssignmentView = {
  id: string;
  assignment_type: string;
  active: boolean;
  starts_on: string;
  scaleCode: string;
  scaleName: string;
  latestScore: number | null;
  latestSeverity: string | null;
  latestAt: string | null;
};

/** Escalas activadas al paciente + última puntuación de cada una. */
export async function getScaleAssignments(
  patientId: string,
): Promise<ScaleAssignmentView[]> {
  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("scale_assignments")
    .select("id, assignment_type, active, starts_on, scales(code, name)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (!assignments || assignments.length === 0) return [];

  const { data: responses } = await supabase
    .from("scale_responses")
    .select("assignment_id, score, severity, submitted_at")
    .eq("patient_id", patientId)
    .order("submitted_at", { ascending: false });

  const latest = new Map<
    string,
    { score: number | null; severity: string | null; submitted_at: string }
  >();
  for (const r of responses ?? []) {
    if (!latest.has(r.assignment_id)) {
      latest.set(r.assignment_id, {
        score: r.score,
        severity: r.severity,
        submitted_at: r.submitted_at,
      });
    }
  }

  return assignments.map((a) => {
    const scale = a.scales as unknown as { code: string; name: string } | null;
    const l = latest.get(a.id);
    return {
      id: a.id,
      assignment_type: a.assignment_type,
      active: a.active,
      starts_on: a.starts_on,
      scaleCode: scale?.code ?? "?",
      scaleName: scale?.name ?? "?",
      latestScore: l?.score ?? null,
      latestSeverity: l?.severity ?? null,
      latestAt: l?.submitted_at ?? null,
    };
  });
}

/** Próximas citas del paciente. */
export async function getUpcomingAppointments(
  patientId: string,
): Promise<Appointment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .gt("starts_at", new Date().toISOString())
    .in("status", ["scheduled", "confirmed"])
    .order("starts_at", { ascending: true });
  return data ?? [];
}

export type PaymentsSummary = {
  payments: Payment[];
  debtCents: number;
  packRemaining: number;
};

/** Pagos del paciente + deuda pendiente + sesiones de bono restantes. */
export async function getPaymentsSummary(
  patientId: string,
): Promise<PaymentsSummary> {
  const supabase = await createClient();
  const [{ data: payments }, { data: packs }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("session_packs")
      .select("total_sessions, used_sessions, active")
      .eq("patient_id", patientId),
  ]);

  const debtCents = (payments ?? [])
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const packRemaining = (packs ?? [])
    .filter((p) => p.active)
    .reduce((sum, p) => sum + (p.total_sessions - p.used_sessions), 0);

  return { payments: payments ?? [], debtCents, packRemaining };
}

/** Entradas recientes del diario emocional (solo lectura para el profesional). */
export async function getRecentMoodEntries(
  patientId: string,
  limit = 30,
): Promise<MoodEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mood_entries")
    .select("*")
    .eq("patient_id", patientId)
    .order("entry_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Documentos del paciente. */
export async function getDocuments(patientId: string): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
