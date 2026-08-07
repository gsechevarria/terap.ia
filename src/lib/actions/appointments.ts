"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPatient,
  requireOwnedPatient,
  requireProfessional,
} from "@/lib/queries/identity";
import {
  settleAttendedAppointment,
  unsettleAppointment,
} from "@/lib/payments";
import { revalidateAgenda, revalidatePayments } from "@/lib/revalidate";
import { formatDateTime } from "@/lib/format";
import { safeExternalUrl } from "@/lib/url";
import { TZ, fromWallClock, lastDayOfMonth, wallClockParts } from "@/lib/tz";
import type { TablesInsert } from "@/lib/types";

type Freq = "none" | "daily" | "weekly" | "biweekly" | "monthly";
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
    throw new Error(
      "El link de videollamada no es válido. Debe empezar por https:// o http://.",
    );
  }
  return safe;
}

/**
 * i-ésima ocurrencia de una serie, contada SIEMPRE desde la cita original.
 *
 * Dos motivos para no usar `setDate`/`setMonth` ni encadenar desde la anterior:
 *
 *  - `setDate`/`setMonth` operan en la zona del proceso (UTC en Vercel), que no
 *    preserva la hora de pared en Madrid: una serie semanal que cruzase el fin
 *    del horario de verano se desplazaba una hora a partir de ahí.
 *  - Encadenar desde la ocurrencia anterior pierde el día original en cuanto un
 *    mes lo recorta: 31-ene → 28-feb dejaba la serie clavada en el 28 (28-mar,
 *    28-abr…). Anclando en la cita original vuelve al 31 cuando el mes da.
 */
function occurrenceAt(anchor: Date, freq: Freq, i: number): Date {
  const { y, m, d, hh, mm } = wallClockParts(anchor);
  if (freq === "daily") return fromWallClock(y, m, d + i, hh, mm);
  if (freq === "weekly") return fromWallClock(y, m, d + 7 * i, hh, mm);
  if (freq === "biweekly") return fromWallClock(y, m, d + 14 * i, hh, mm);
  if (freq === "monthly") {
    // Normaliza el año antes de recortar el día: `lastDayOfMonth` necesita un
    // mes real, y la serie puede saltar de diciembre a enero.
    const total = m - 1 + i;
    const ny = y + Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return fromWallClock(ny, nm, Math.min(d, lastDayOfMonth(ny, nm)), hh, mm);
  }
  return anchor;
}

export type CreateAppointmentResult =
  | { ok: true }
  | { ok: false; conflict: string };

/**
 * Crea una cita (y sus repeticiones si es recurrente) + notifica al paciente.
 * Si detecta un solape con otra cita o un bloqueo y `force` no es true, NO crea
 * nada y devuelve un aviso para que el profesional confirme.
 */
export async function createAppointmentAction(input: {
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
    throw new Error("La duración debe ser mayor que cero.");
  }
  const durationMs = end.getTime() - start.getTime();

  const supabase = await createClient();

  // Todas las ocurrencias (la principal + las repeticiones).
  const occurrences: { start: Date; end: Date }[] = [{ start, end }];
  if (input.freq !== "none") {
    const until = input.until ? new Date(input.until) : null;
    for (let i = 1; i <= RECURRENCE_CAP; i++) {
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

  const { data: patient } = await supabase
    .from("patients")
    .select("user_id")
    .eq("id", input.patientId)
    .maybeSingle();
  if (patient?.user_id) {
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: patient.user_id,
      professional_id: pro.id,
      patient_id: input.patientId,
      channel: "push",
      type: "appointment_created",
      title: "Nueva cita",
      body: `Se ha programado una cita para el ${formatDateTime(start.toISOString())}.`,
      // `null`, NO la hora de inicio de la cita: el cron solo envía lo que
      // cumple `scheduled_for is null or <= now()`, así que programar una cita
      // para dentro de dos semanas dejaba el aviso "Nueva cita" en cola 14 días
      // y se entregaba justo cuando la sesión empezaba.
      scheduled_for: null,
      payload: {
        kind: "appointment",
        appointment_id: parentId,
        starts_at: start.toISOString(),
        url: "/app/appointments",
      },
      status: "queued",
    });
    // La cita ya está creada: no se revierte por un fallo al encolar, pero
    // tampoco se traga en silencio (antes nadie se enteraba de que el paciente
    // no iba a recibir el aviso).
    if (notifErr) {
      console.error("[appointments] no se pudo encolar la notificación", {
        appointmentId: parentId,
        error: notifErr.message,
      });
    }
  }

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
  const windowStart = occurrences[0].start.toISOString();
  const windowEnd = occurrences[occurrences.length - 1].end.toISOString();

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
    .order("starts_at")
    .limit(2000);
  if (excludeId) apptQuery = apptQuery.neq("id", excludeId);

  const [apptRes, blockRes] = await Promise.all([
    apptQuery,
    supabase
      .from("agenda_blocks")
      .select("starts_at, ends_at, reason")
      .eq("professional_id", professionalId)
      .lt("starts_at", windowEnd)
      .gt("ends_at", windowStart)
      .order("starts_at")
      .limit(2000),
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

  if (hits.length === 0) return null;

  const first = hits[0];
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

export async function updateAppointmentAction(input: {
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
    throw new Error("La duración debe ser mayor que cero.");
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

export async function cancelAppointmentAction(id: string) {
  const pro = await requireProfessional();
  // Antes de cancelar hay que deshacer la liquidación: si la cita estaba
  // marcada como "acudió", el bono quedaba consumido y el pago creado.
  await unsettleAppointment(id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled", attendance: "pending" })
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidateAgenda();
  revalidatePayments();
}

export async function deleteAppointmentAction(id: string) {
  const pro = await requireProfessional();
  // Imprescindible ANTES de borrar: `payments.appointment_id` es `on delete
  // set null`, así que al borrar la cita el pago quedaba huérfano y sin forma
  // de reconciliarlo con nada.
  await unsettleAppointment(id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidateAgenda();
  revalidatePayments();
}

const ATTENDANCE_VALUES = [
  "pending",
  "attended",
  "no_show",
  "late_cancel",
] as const;
type Attendance = (typeof ATTENDANCE_VALUES)[number];

export async function setAttendanceAction(id: string, attendance: Attendance) {
  const pro = await requireProfessional();
  // El tipo de TypeScript no existe en runtime y esto es un endpoint HTTP.
  if (!(ATTENDANCE_VALUES as readonly string[]).includes(attendance)) {
    throw new Error("Estado de asistencia no válido.");
  }

  const supabase = await createClient();

  // Hay que leer el estado ANTERIOR: corregir un "acudió" puesto por error
  // dejaba el bono consumido y el pago creado, y el paciente perdía una sesión
  // que había pagado.
  const { data: prev } = await supabase
    .from("appointments")
    .select("patient_id, attendance")
    .eq("id", id)
    .eq("professional_id", pro.id)
    .maybeSingle();
  if (!prev) throw new Error("Cita no encontrada.");

  if (prev.attendance === "attended" && attendance !== "attended") {
    await unsettleAppointment(id);
  }

  const patch: { attendance: Attendance; status?: "completed" } = { attendance };
  if (attendance === "attended") patch.status = "completed";

  const { data: updated, error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .eq("professional_id", pro.id)
    .select("patient_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Cita no encontrada.");

  // Consumo de bono / pago pendiente automático al acudir (idempotente en BD).
  if (attendance === "attended") {
    await settleAttendedAppointment(id);
  }

  revalidateAgenda(updated.patient_id);
  // Liquidar o deshacer mueve los agregados de pagos, la analítica y la
  // estimación fiscal, no solo la agenda.
  if (attendance === "attended" || prev.attendance === "attended") {
    revalidatePayments(updated.patient_id);
  }
}

// ---- Bloqueos de agenda ----------------------------------------------------
export async function createBlockAction(input: {
  startsAt: string;
  endsAt: string;
  reason?: string;
}) {
  const pro = await requireProfessional();
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
  revalidateAgenda();
}

export async function deleteBlockAction(id: string) {
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
export async function respondAppointmentAction(
  id: string,
  action: "confirm" | "cancel",
) {
  const patient = await getCurrentPatient();
  if (!patient) throw new Error("Cuenta no vinculada.");
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
