import { allRows } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { getPaymentsOverview } from "@/lib/queries/payments";
import { resumirAnalitica, type Analitica } from "@/lib/analitica";

/**
 * Lee lo que necesita la analítica y delega el cálculo en `resumirAnalitica`,
 * que es puro y tiene pruebas. Todas las lecturas van acotadas al profesional
 * (o a sus pacientes) además de por la RLS, y ninguna embebe otra tabla.
 *
 * Solo se piden los últimos 30 días de diario, respuestas y tareas: es la única
 * ventana que se usa de ellos.
 */
export async function getProfessionalAnalytics(ahora: Date): Promise<Analitica | null> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return null;

  const hace30 = new Date(ahora.getTime() - 30 * 86_400_000).toISOString();

  const [pacientesRes, citasRes, cobros] = await Promise.all([
    allRows(supabase
      .from("patients")
      .select("id, status, created_at, user_id")
      .eq("professional_id", pro.id)),
    allRows(supabase
      .from("appointments")
      .select("id, patient_id, starts_at, ends_at, status, attendance")
      .eq("professional_id", pro.id)),
    getPaymentsOverview(),
  ]);

  const pacientes = pacientesRes.data ?? [];
  const ids = pacientes.map((p) => p.id);

  const vacio = { data: [] as never[] };
  const [escalasRes, respuestasRes, riesgoRes, diarioRes, tareasRes, completadasRes] =
    ids.length === 0
      ? [vacio, vacio, vacio, vacio, vacio, vacio]
      : await Promise.all([
          allRows(supabase
            .from("scale_assignments")
            .select("id, patient_id")
            .eq("professional_id", pro.id)
            .eq("active", true)),
          allRows(supabase
            .from("scale_responses")
            .select("id, patient_id, submitted_at")
            .in("patient_id", ids)
            .gte("submitted_at", hace30)),
          allRows(supabase
            .from("scale_responses")
            .select("id, patient_id")
            .in("patient_id", ids)
            .eq("flagged", true)
            .is("acknowledged_at", null)),
          allRows(supabase
            .from("mood_entries")
            .select("id, patient_id, created_at")
            .in("patient_id", ids)
            .gte("created_at", hace30)),
          allRows(supabase
            .from("tasks")
            .select("id, patient_id, created_at")
            .eq("professional_id", pro.id)
            .gte("created_at", hace30)),
          allRows(supabase
            .from("task_completions")
            .select("id, task_id, completed_at")
            .in("patient_id", ids)
            .gte("created_at", hace30)),
        ]);

  return resumirAnalitica(
    {
      pacientes: pacientes.map((p) => ({
        id: p.id,
        status: p.status,
        created_at: p.created_at,
        tieneCuenta: p.user_id !== null,
      })),
      citas: citasRes.data ?? [],
      cobradoPorMes: cobros.byMonth,
      pendienteCents: cobros.totalPendingCents,
      conEscalaActiva: new Set((escalasRes.data ?? []).map((a) => a.patient_id)),
      respuestasEscala: respuestasRes.data ?? [],
      riesgoSinRevisar: (riesgoRes.data ?? []).length,
      entradasDiario: diarioRes.data ?? [],
      tareas: tareasRes.data ?? [],
      tareasCompletadas: completadasRes.data ?? [],
    },
    ahora,
  );
}
