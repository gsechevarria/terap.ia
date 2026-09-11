import { allRows, checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient, getCurrentProfessional } from "@/lib/queries/identity";
import type { Tables } from "@/lib/types";

export type AppointmentRequest = Tables<"appointment_requests">;

/** Solicitud + nombre del paciente y horario de la cita afectada (si la hay). */
export type PendingRequest = AppointmentRequest & {
  patientName: string | null;
  appointmentStart: string | null;
};

const SELECT =
  "id, professional_id, patient_id, appointment_id, kind, preferred_start, alt_start, duration_min, note, status, resolution_note, resolved_at, created_at";

type Joined = AppointmentRequest & {
  patients: { full_name: string | null } | null;
  appointments: { starts_at: string } | null;
};

function flatten(rows: Joined[]): PendingRequest[] {
  return rows.map((r) => {
    const { patients, appointments, ...rest } = r;
    return {
      ...(rest as AppointmentRequest),
      patientName: patients?.full_name ?? null,
      appointmentStart: appointments?.starts_at ?? null,
    };
  });
}

/**
 * Bandeja del profesional. `scope` separa lo que requiere decisión de lo ya
 * resuelto, que se conserva como historial de lo que pidió el paciente.
 */
export async function getRequestsForProfessional(
  scope: "pending" | "resolved" = "pending",
): Promise<PendingRequest[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];

  let q = supabase
    .from("appointment_requests")
    .select(`${SELECT}, patients(full_name), appointments(starts_at)`)
    .eq("professional_id", pro.id);

  q = scope === "pending"
    ? q.eq("status", "pending").order("created_at", { ascending: true })
    : q.neq("status", "pending").order("resolved_at", { ascending: false }).limit(50);

  const { data } = await allRows(q);
  return flatten((data ?? []) as Joined[]);
}

/**
 * Contador para el aviso del menú. `head: true` no trae filas: solo el número.
 */
export async function countPendingRequests(): Promise<number> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return 0;
  const { count } = await checked(
    supabase
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", pro.id)
      .eq("status", "pending"),
  );
  return count ?? 0;
}

/**
 * Lo que ha pedido el paciente actual: las vivas, y las últimas resueltas para
 * que vea la respuesta sin tener que preguntar.
 */
export async function getMyRequests(): Promise<{
  pending: AppointmentRequest[];
  recent: AppointmentRequest[];
}> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return { pending: [], recent: [] };

  const { data } = await allRows(
    supabase
      .from("appointment_requests")
      .select(SELECT)
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(20),
  );
  const rows = (data ?? []) as AppointmentRequest[];
  return {
    pending: rows.filter((r) => r.status === "pending"),
    recent: rows.filter((r) => r.status !== "pending").slice(0, 5),
  };
}

/** Solicitudes vivas indexadas por cita, para marcar "cambio pedido" en la lista. */
export async function getMyPendingByAppointment(): Promise<
  Map<string, AppointmentRequest>
> {
  const { pending } = await getMyRequests();
  const map = new Map<string, AppointmentRequest>();
  for (const r of pending) if (r.appointment_id) map.set(r.appointment_id, r);
  return map;
}
