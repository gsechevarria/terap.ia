"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { allRows } from "@/lib/query-result";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPatient,
  requireOwnedPatient,
  requireProfessional,
} from "@/lib/queries/identity";

import { revalidateAgenda, revalidatePayments, revalidateRequests } from "@/lib/revalidate";
import { formatDateTime } from "@/lib/format";
import { safeExternalUrl } from "@/lib/url";
import { TZ } from "@/lib/tz";
import { occurrenceAt, type Freq } from "@/lib/recurrence";
import type { TablesInsert } from "@/lib/types";

const RECURRENCE_CAP = 26;

/**
 * Normaliza el link de videollamada, o lanza si no es http(s).
 *
 * Se rechaza en vez de guardarlo en silencio para que el profesional se entere:
 * el campo se pinta como `href` en la agenda y en la app del paciente, así que
 * un `javascript:` ahí sería XSS almacenado con un clic.
 */
function checkVideoLink(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const safe = safeExternalUrl(raw);
  if (!safe) {
    throw new ActionInputError(
      "El link de videollamada no es válido. Debe empezar por https:// o http://.",
    );
  }
  return safe;
}

export type CreateAppointmentResult =
  | { ok: true }
  | { ok: false; conflict: string };

/**
 * Crea una cita (y sus repeticiones si es recurrente) + notifica al paciente.
 * Si detecta un solape con otra cita o un bloqueo y `force` no es true, NO crea
 * nada y devuelve un aviso para que el profesional confirme.
 */
async function createAppointmentActionImpl(input: {
  patientId: string;
  startsAt: string; // ISO (UTC), convertido en el cliente desde hora local
  endsAt: string;
  videoLink?: string;
  freq: Freq;
  until?: string | null;
  notes?: string;
  force?: boolean;
}): Promise<CreateAppointmentResult> {
  const { pro } = await requireOwnedPatient(input.patientId);
  const videoLink = checkVideoLink(input.videoLink);

  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) {
    throw new ActionInputError("La duración debe ser mayor que cero.");
  }
  const durationMs = end.getTime() - start.getTime();

  const supabase = await createClient();

  // Todas las ocurrencias (la principal + las repeticiones).
  const occurrences: { start: Date; end: Date }[] = [{ start, end }];
  if (input.freq !== "none") {
    const until = input.until ? new Date(input.until) : null;
    for (let i = 1; i < RECURRENCE_CAP; i++) {
      const cur = occurrenceAt(start, input.freq, i);
      if (until && cur.getTime() > until.getTime()) break;
      occurrences.push({ start: cur, end: new Date(cur.getTime() + durationMs) });
    }
  }

  // Solapes de la serie con lo que ya hay en la agenda.
  if (!input.force) {
    const conflict = await findConflict(supabase, pro.id, occurrences);
    if (conflict) return { ok: false, conflict };

    // Y solapes de las ocurrencias ENTRE SÍ: con `daily` y una duración de más
    // de 24 h, cada ocurrencia pisa la siguiente y no se avisaba. O(n²) con
    // n ≤ 26, es gratis.
    const selfConflict = findSelfOverlap(occurrences);
    if (selfConflict) return { ok: false, conflict: selfConflict };
  }

  // El id de la cita madre se genera aquí para poder insertar TODA la serie en
  // una sola sentencia. Antes eran dos inserts: si el segundo fallaba quedaba
  // una cita huérfana ya notificada, y al reintentar se duplicaba.
  const parentId = crypto.randomUUID();
  const base = {
    professional_id: pro.id,
    patient_id: input.patientId,
    video_link: videoLink,
    notes: input.notes?.trim() || null,
    recurrence_freq: input.freq,
    recurrence_until: input.until || null,
  };

  const rows: TablesInsert<"appointments">[] = occurrences.map((o, i) => ({
    ...base,
    id: i === 0 ? parentId : undefined,
    starts_at: o.start.toISOString(),
    ends_at: o.end.toISOString(),
    parent_appointment_id: i === 0 ? null : parentId,
  }));

  const { error } = await supabase.from("appointments").insert(rows);
  if (error) throw new Error(error.message);

  revalidateAgenda(input.patientId);
  return { ok: true };
}

/** Primer solape entre dos ocurrencias de la propia serie generada. */
function findSelfOverlap(
  occurrences: { start: Date; end: Date }[],
): string | null {
  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      const a = occurrences[i];
      const b = occurrences[j];
      if (!a || !b) continue;
      if (b.start.getTime() < a.end.getTime() && b.end.getTime() > a.start.getTime()) {
        return `Las repeticiones se solapan entre sí (${formatDateTime(
          a.start.toISOString(),
        )} y ${formatDateTime(
          b.start.toISOString(),
        )}). Reduce la duración o cambia la frecuencia.`;
      }
    }
  }
  return null;
}

/**
 * Busca el primer solape de cualquier ocurrencia con una cita (no cancelada) o
 * un bloqueo del profesional. Devuelve un mensaje de aviso, o null si no hay.
 */
async function findConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
  occurrences: { start: Date; end: Date }[],
  excludeId?: string,
): Promise<string | null> {
  const primera = occurrences[0];
  const ultima = occurrences[occurrences.length - 1];
  if (!primera || !ultima) return null;
  const windowStart = primera.start.toISOString();
  const windowEnd = ultima.end.toISOString();

  // `order` + `limit` explícitos: sin ellos, la ventana de una serie de 26
  // ocurrencias (medio año) puede superar el `db-max-rows` de PostgREST y el
  // recorte, además, sería no determinista — se dejarían de detectar solapes
  // sin ningún aviso.
  let apptQuery = supabase
    .from("appointments")
    .select("starts_at, ends_at, patients(full_name)")
    .eq("professional_id", professionalId)
    .neq("status", "cancelled")
    .lt("starts_at", windowEnd)
    .gt("ends_at", windowStart)
    .order("starts_at");
  if (excludeId) apptQuery = apptQuery.neq("id", excludeId);

  const [apptRes, blockRes] = await Promise.all([
    allRows(apptQuery),
    allRows(supabase
      .from("agenda_blocks")
      .select("starts_at, ends_at, reason")
      .eq("professional_id", professionalId)
      .lt("starts_at", windowEnd)
      .gt("ends_at", windowStart)
      .order("starts_at")),
  ]);

  const overlaps = (aStart: Date, aEnd: Date, bStart: string, bEnd: string) =>
    new Date(bStart).getTime() < aEnd.getTime() &&
    new Date(bEnd).getTime() > aStart.getTime();

  const appts = (apptRes.data ?? []) as {
    starts_at: string;
    ends_at: string;
    patients: { full_name: string | null } | null;
  }[];
  const blocks = (blockRes.data ?? []) as {
    starts_at: string;
    ends_at: string;
    reason: string | null;
  }[];

  type Hit = { occ: Date; kind: "appt" | "block"; label: string };
  const hits: Hit[] = [];
  for (const o of occurrences) {
    for (const a of appts) {
      if (overlaps(o.start, o.end, a.starts_at, a.ends_at)) {
        hits.push({
          occ: o.start,
          kind: "appt",
          label: `la cita de ${a.patients?.full_name ?? "otro paciente"}`,
        });
        break;
      }
    }
    if (hits.some((h) => h.occ === o.start)) continue;
    for (const b of blocks) {
      if (overlaps(o.start, o.end, b.starts_at, b.ends_at)) {
        hits.push({
          occ: o.start,
          kind: "block",
          label: b.reason ? `un bloqueo (${b.reason})` : "un bloqueo",
        });
        break;
      }
    }
  }

  const first = hits[0];
  if (!first) return null;

  const when = first.occ.toLocaleString("es-ES", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  let msg = `Esta cita se solapa con ${first.label} (${when}).`;
  if (hits.length > 1) {
    msg += ` Hay ${hits.length - 1} solape${hits.length - 1 > 1 ? "s" : ""} más en la serie.`;
  }
  return msg;
}

async function updateAppointmentActionImpl(input: {
  id: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  videoLink?: string;
  notes?: string;
  force?: boolean;
}): Promise<CreateAppointmentResult> {
  const { pro } = await requireOwnedPatient(input.patientId);
  const videoLink = checkVideoLink(input.videoLink);
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) {
    throw new ActionInputError("La duración debe ser mayor que cero.");
  }
  const supabase = await createClient();

  if (!input.force) {
    const conflict = await findConflict(
      supabase,
      pro.id,
      [{ start, end }],
      input.id,
    );
    if (conflict) return { ok: false, conflict };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      video_link: videoLink,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidateAgenda(input.patientId);
  return { ok: true };
}

export type SetAttendanceResult = { warning?: string };
type Attendance = "pending" | "attended" | "no_show" | "late_cancel";

async function changeAppointment(id: string, action: string, attendance?: Attendance): Promise<SetAttendanceResult> {
  await requireProfessional();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("change_appointment", {
    p_id: id, p_action: action, p_attendance: attendance,
  });
  if (error) throw new Error(error.message);
  revalidateAgenda();
  revalidatePayments();
  return data === "conservado_cobrado"
    ? { warning: "Se conserva el cobro registrado. Revisa Pagos si corresponde una devolución." }
    : {};
}
async function cancelAppointmentActionImpl(id: string) {
  return changeAppointment(id, "cancel");
}
async function deleteAppointmentActionImpl(id: string) {
  return changeAppointment(id, "delete");
}
async function setAttendanceActionImpl(id: string, attendance: Attendance): Promise<SetAttendanceResult> {
  return changeAppointment(id, "attendance", attendance);
}

// ---- Bloqueos de agenda ----------------------------------------------------
async function createBlockActionImpl(input: {
  startsAt: string;
  endsAt: string;
  reason?: string;
}) {
  const pro = await requireProfessional();
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) {
    throw new ActionInputError("El fin del bloqueo debe ser posterior al inicio.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_blocks").insert({
    professional_id: pro.id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidateAgenda();
}

async function deleteBlockActionImpl(id: string) {
  const pro = await requireProfessional();
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_blocks")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidateAgenda();
}

// ---- Lado paciente ---------------------------------------------------------
async function respondAppointmentActionImpl(
  id: string,
  action: "confirm" | "cancel",
) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");
  const supabase = await createClient();
  // Vía RPC acotada: el paciente solo puede confirmar/cancelar sus propias citas
  // (no reescribir horario, notas del profesional, etc.). La RLS de UPDATE
  // directo por el paciente se retiró en 20260725090001_rls_patient_hardening.
  const { error } = await supabase.rpc("patient_respond_appointment", {
    p_appointment_id: id,
    p_action: action,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app");
  revalidatePath("/app/appointments");
}

// ---- Solicitudes de cita ---------------------------------------------------
// El paciente pide; el profesional decide. Toda la validación real (propiedad,
// antelación, solapes, tope de pendientes) vive en las funciones de BD: son
// `security definer` y son el único camino de escritura, así que saltarse la
// interfaz no sirve de nada.

export type RequestKind = "new" | "reschedule" | "cancel";

async function requestAppointmentActionImpl(input: {
  kind: RequestKind;
  /** ISO (UTC), convertido en el cliente desde la hora local. */
  preferredStart?: string | null;
  altStart?: string | null;
  durationMin?: number;
  note?: string;
  appointmentId?: string;
}): Promise<string> {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("patient_request_appointment", {
    p_kind: input.kind,
    p_preferred_start: input.preferredStart ?? null,
    p_alt_start: input.altStart ?? null,
    p_duration_min: input.durationMin ?? 50,
    p_note: input.note?.trim() || null,
    p_appointment_id: input.appointmentId ?? null,
  });
  if (error) throw new Error(error.message);

  revalidateRequests();
  return data as string;
}

async function withdrawRequestActionImpl(id: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("patient_withdraw_request", { p_id: id });
  if (error) throw new Error(error.message);
  revalidateRequests();
}

async function resolveRequestActionImpl(input: {
  id: string;
  action: "accept" | "decline";
  /** Solo si el profesional corrige el horario propuesto. */
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string;
}) {
  await requireProfessional();
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_appointment_request", {
    p_id: input.id,
    p_action: input.action,
    p_start: input.startsAt ?? null,
    p_end: input.endsAt ?? null,
    p_note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidateRequests();
  revalidateAgenda();
}

export async function createAppointmentAction(...args: Parameters<typeof createAppointmentActionImpl>) { return runAction(() => createAppointmentActionImpl(...args)); }

export async function requestAppointmentAction(...args: Parameters<typeof requestAppointmentActionImpl>) { return runAction(() => requestAppointmentActionImpl(...args)); }

export async function withdrawRequestAction(...args: Parameters<typeof withdrawRequestActionImpl>) { return runAction(() => withdrawRequestActionImpl(...args)); }

export async function resolveRequestAction(...args: Parameters<typeof resolveRequestActionImpl>) { return runAction(() => resolveRequestActionImpl(...args)); }

export async function updateAppointmentAction(...args: Parameters<typeof updateAppointmentActionImpl>) { return runAction(() => updateAppointmentActionImpl(...args)); }

export async function cancelAppointmentAction(...args: Parameters<typeof cancelAppointmentActionImpl>) { return runAction(() => cancelAppointmentActionImpl(...args)); }

export async function deleteAppointmentAction(...args: Parameters<typeof deleteAppointmentActionImpl>) { return runAction(() => deleteAppointmentActionImpl(...args)); }

export async function setAttendanceAction(...args: Parameters<typeof setAttendanceActionImpl>) { return runAction(() => setAttendanceActionImpl(...args)); }

export async function createBlockAction(...args: Parameters<typeof createBlockActionImpl>) { return runAction(() => createBlockActionImpl(...args)); }

export async function deleteBlockAction(...args: Parameters<typeof deleteBlockActionImpl>) { return runAction(() => deleteBlockActionImpl(...args)); }

export async function respondAppointmentAction(...args: Parameters<typeof respondAppointmentActionImpl>) { return runAction(() => respondAppointmentActionImpl(...args)); }
