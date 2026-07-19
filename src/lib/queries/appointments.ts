import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient, getCurrentProfessional } from "@/lib/queries/identity";
import type { Appointment } from "@/lib/types";

export type AgendaAppointment = Appointment & { patientName: string | null };
export type AgendaBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Agenda del profesional: citas (con nombre de paciente) + bloqueos, desde hoy. */
export async function getProfessionalAgenda(): Promise<{
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
}> {
  const supabase = await createClient();
  const from = startOfToday();

  const [apptRes, blockRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, professional_id, patient_id, starts_at, ends_at, status, attendance, video_link, recurrence_freq, recurrence_until, parent_appointment_id, notes, created_at, updated_at, patients(full_name)",
      )
      .gte("starts_at", from)
      .order("starts_at", { ascending: true }),
    supabase
      .from("agenda_blocks")
      .select("id, starts_at, ends_at, reason")
      .gte("starts_at", from)
      .order("starts_at", { ascending: true }),
  ]);

  const appointments: AgendaAppointment[] = (apptRes.data ?? []).map((a) => {
    const { patients, ...rest } = a as typeof a & {
      patients: { full_name: string | null } | null;
    };
    return { ...(rest as Appointment), patientName: patients?.full_name ?? null };
  });

  return { appointments, blocks: (blockRes.data ?? []) as AgendaBlock[] };
}

/**
 * Agenda del profesional en un rango [from, to): citas y bloqueos que solapan
 * el rango (para el calendario con vistas de día/semana/mes).
 */
export async function getProfessionalAgendaRange(
  fromISO: string,
  toISO: string,
): Promise<{ appointments: AgendaAppointment[]; blocks: AgendaBlock[] }> {
  const supabase = await createClient();

  const [apptRes, blockRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, professional_id, patient_id, starts_at, ends_at, status, attendance, video_link, recurrence_freq, recurrence_until, parent_appointment_id, notes, created_at, updated_at, patients(full_name)",
      )
      .lt("starts_at", toISO)
      .gt("ends_at", fromISO)
      .order("starts_at", { ascending: true }),
    supabase
      .from("agenda_blocks")
      .select("id, starts_at, ends_at, reason")
      .lt("starts_at", toISO)
      .gt("ends_at", fromISO)
      .order("starts_at", { ascending: true }),
  ]);

  const appointments: AgendaAppointment[] = (apptRes.data ?? []).map((a) => {
    const { patients, ...rest } = a as typeof a & {
      patients: { full_name: string | null } | null;
    };
    return { ...(rest as Appointment), patientName: patients?.full_name ?? null };
  });

  return { appointments, blocks: (blockRes.data ?? []) as AgendaBlock[] };
}

/** Pacientes activos del profesional (para el selector al crear cita). */
export async function getPatientsForSelect(): Promise<
  { id: string; full_name: string | null }[]
> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("professional_id", pro.id)
    .eq("status", "active")
    .order("full_name", { ascending: true });
  return data ?? [];
}

/** Cita individual + nombre de paciente (para .ics / edición). */
export async function getAppointment(
  id: string,
): Promise<AgendaAppointment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, patients(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { patients, ...rest } = data as typeof data & {
    patients: { full_name: string | null } | null;
  };
  return { ...(rest as Appointment), patientName: patients?.full_name ?? null };
}

/** Citas del paciente actual (todas, ordenadas). */
export async function getMyAppointments(): Promise<Appointment[]> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return [];
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patient.id)
    .order("starts_at", { ascending: true });
  return data ?? [];
}

/** Citas del paciente separadas en próximas y pasadas (respecto a ahora). */
export async function getMyAppointmentsSplit(): Promise<{
  upcoming: Appointment[];
  past: Appointment[];
}> {
  const all = await getMyAppointments();
  const now = Date.now();
  const upcoming = all.filter((a) => new Date(a.ends_at).getTime() >= now);
  const past = all
    .filter((a) => new Date(a.ends_at).getTime() < now)
    .reverse();
  return { upcoming, past };
}
