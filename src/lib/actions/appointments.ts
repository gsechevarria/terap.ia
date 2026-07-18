"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient, getCurrentProfessional } from "@/lib/queries/identity";
import { settleAttendedAppointment } from "@/lib/payments";
import type { TablesInsert } from "@/lib/types";

type Freq = "none" | "daily" | "weekly" | "biweekly" | "monthly";
const RECURRENCE_CAP = 26;

function nextOccurrence(d: Date, freq: Freq): Date {
  const n = new Date(d);
  if (freq === "daily") n.setDate(n.getDate() + 1);
  else if (freq === "weekly") n.setDate(n.getDate() + 7);
  else if (freq === "biweekly") n.setDate(n.getDate() + 14);
  else if (freq === "monthly") n.setMonth(n.getMonth() + 1);
  return n;
}

/** Crea una cita (y sus repeticiones si es recurrente) + notifica al paciente. */
export async function createAppointmentAction(input: {
  patientId: string;
  startsAt: string; // ISO (UTC), convertido en el cliente desde hora local
  endsAt: string;
  videoLink?: string;
  freq: Freq;
  until?: string | null;
  notes?: string;
}) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");

  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) {
    throw new Error("La hora de fin debe ser posterior al inicio.");
  }
  const durationMs = end.getTime() - start.getTime();

  const supabase = await createClient();
  const base = {
    professional_id: pro.id,
    patient_id: input.patientId,
    video_link: input.videoLink?.trim() || null,
    notes: input.notes?.trim() || null,
    recurrence_freq: input.freq,
    recurrence_until: input.until || null,
  };

  const { data: first, error } = await supabase
    .from("appointments")
    .insert({ ...base, starts_at: start.toISOString(), ends_at: end.toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (input.freq !== "none") {
    const until = input.until ? new Date(input.until) : null;
    const rows: TablesInsert<"appointments">[] = [];
    let cur = nextOccurrence(start, input.freq);
    let count = 0;
    while (count < RECURRENCE_CAP) {
      if (until && cur.getTime() > until.getTime()) break;
      rows.push({
        ...base,
        starts_at: cur.toISOString(),
        ends_at: new Date(cur.getTime() + durationMs).toISOString(),
        parent_appointment_id: first.id,
      });
      cur = nextOccurrence(cur, input.freq);
      count++;
    }
    if (rows.length) {
      const { error: e2 } = await supabase.from("appointments").insert(rows);
      if (e2) throw new Error(e2.message);
    }
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("user_id")
    .eq("id", input.patientId)
    .maybeSingle();
  if (patient?.user_id) {
    await supabase.from("notifications").insert({
      user_id: patient.user_id,
      professional_id: pro.id,
      patient_id: input.patientId,
      channel: "push",
      type: "appointment_created",
      title: "Nueva cita",
      body: `Se ha programado una cita para el ${start.toLocaleString("es-ES")}.`,
      scheduled_for: start.toISOString(),
      status: "queued",
    });
  }

  revalidatePath("/pro/agenda");
  revalidatePath(`/pro/patients/${input.patientId}`);
}

export async function updateAppointmentAction(input: {
  id: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  videoLink?: string;
  notes?: string;
}) {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) {
    throw new Error("La hora de fin debe ser posterior al inicio.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      video_link: input.videoLink?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/pro/agenda");
}

export async function cancelAppointmentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pro/agenda");
}

export async function deleteAppointmentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pro/agenda");
}

export async function setAttendanceAction(
  id: string,
  attendance: "pending" | "attended" | "no_show" | "late_cancel",
) {
  const supabase = await createClient();
  const patch: { attendance: typeof attendance; status?: "completed" } = {
    attendance,
  };
  if (attendance === "attended") patch.status = "completed";
  const { error } = await supabase.from("appointments").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  // Consumo de bono / pago pendiente automático al acudir.
  if (attendance === "attended") {
    await settleAttendedAppointment(id);
  }
  revalidatePath("/pro/agenda");
}

// ---- Bloqueos de agenda ----------------------------------------------------
export async function createBlockAction(input: {
  startsAt: string;
  endsAt: string;
  reason?: string;
}) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) {
    throw new Error("El fin del bloqueo debe ser posterior al inicio.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_blocks").insert({
    professional_id: pro.id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/pro/agenda");
}

export async function deleteBlockAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pro/agenda");
}

// ---- Lado paciente ---------------------------------------------------------
export async function respondAppointmentAction(
  id: string,
  action: "confirm" | "cancel",
) {
  const patient = await getCurrentPatient();
  if (!patient) throw new Error("Cuenta no vinculada.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: action === "confirm" ? "confirmed" : "cancelled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app");
  revalidatePath("/app/appointments");
}
