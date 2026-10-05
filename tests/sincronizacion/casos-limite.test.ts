/*
 * Casos límite de la sincronización. Cada expectativa describe el
 * comportamiento CORRECTO. Los marcados [H…] fallaban en la prueba del 6-oct y
 * se corrigieron el mismo día; ver docs/SINCRONIZACION.md.
 */
import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { actuarComo, admin, nuevoUsuario, type Actor } from "./actores";

import type { ActionResult } from "@/lib/action-result";
import { createTaskAction } from "@/lib/actions/tasks";
import { cancelAppointmentAction, createAppointmentAction, requestAppointmentAction, resolveRequestAction } from "@/lib/actions/appointments";
import { createScaleAssignmentAction } from "@/lib/actions/scales";
import { addMoodEntryAction, deleteMoodEntryAction } from "@/lib/actions/mood";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getPatientAppointments, getRecentMoodEntries, getUpcomingAppointments } from "@/lib/queries/patient-detail";
import { countPendingRequests, getRequestsForProfessional } from "@/lib/queries/appointment-requests";
import { getScaleCatalog } from "@/lib/queries/scales";
import { listPatientsWithOverview } from "@/lib/queries/patients";
import { getMyMoodEntries } from "@/lib/queries/wellbeing";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const enHoras = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

async function ok<T>(p: Promise<ActionResult<T>>): Promise<T> {
  const r = await p;
  if (!r.success) throw new Error(`La acción falló: ${r.error}`);
  return r.data;
}
async function como<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  actuarComo(actor);
  return fn();
}
async function proId(a: Actor): Promise<string> {
  const { data, error } = await a.db.from("professionals").select("id").eq("user_id", a.id).single();
  if (error) throw new Error(error.message);
  return data.id;
}
/** Expediente nuevo de `pro` para la cuenta `paciente`, por el camino real de invitación. */
async function vincular(pro: Actor, paciente: Actor, nombre: string): Promise<string> {
  const profesional = await proId(pro);
  const { data: org } = await admin()
    .from("organization_members")
    .select("organization_id")
    .eq("professional_id", profesional)
    .single();
  const { data: p, error } = await pro.db
    .from("patients")
    .insert({ professional_id: profesional, organization_id: org!.organization_id, full_name: nombre, email: paciente.email })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const token = randomUUID();
  const inv = await pro.db.rpc("issue_invitation", { p_patient_id: p.id, p_token_hash: sha(token) });
  if (inv.error) throw new Error(inv.error.message);
  const c = await paciente.db.rpc("get_onboarding_consent", { p_token: token });
  if (c.error) throw new Error(c.error.message);
  const consent = c.data as { id: string; hash: string };
  const fin = await paciente.db.rpc("complete_onboarding", { p_token: token, p_template_id: consent.id, p_content_hash: consent.hash });
  if (fin.error) throw new Error(fin.error.message);
  return p.id;
}

let pro: Actor;
let paciente: Actor;
let patientId: string;

beforeAll(async () => {
  pro = await nuevoUsuario("professional", "Dra. Límite");
  paciente = await nuevoUsuario("patient", "Paciente Límite");
  patientId = await vincular(pro, paciente, "Paciente Límite");
});

describe("citas en los bordes", () => {
  it("[H1] una sesión EN CURSO sigue apareciendo en el inicio del paciente", async () => {
    await pro.db.from("appointments").insert({
      professional_id: await proId(pro),
      patient_id: patientId,
      starts_at: enHoras(-0.2),
      ends_at: enHoras(0.8),
      status: "confirmed",
      video_link: "https://meet.example.com/en-curso",
    });
    // El inicio filtra `starts_at > now`: a los 5 minutos de empezar, la
    // tarjeta «Próxima sesión» y su botón de videollamada desaparecen.
    const proximas = await como(paciente, () => getUpcomingAppointments(patientId));
    expect(proximas.some((a) => a.video_link === "https://meet.example.com/en-curso")).toBe(true);
  });

  it("[H2] una cita futura CANCELADA sigue visible en la ficha del profesional", async () => {
    await como(pro, () => ok(createAppointmentAction({ patientId, startsAt: enHoras(30), endsAt: enHoras(31), freq: "none" })));
    const { proximas } = await como(pro, () => getPatientAppointments(patientId));
    const cita = proximas.find((a) => new Date(a.starts_at).getTime() === new Date(enHoras(30)).getTime() || a.status === "scheduled")!;
    await como(pro, () => ok(cancelAppointmentAction(cita.id)));
    const despues = await como(pro, () => getPatientAppointments(patientId));
    // Próximas excluye las canceladas e historial exige que ya haya pasado.
    expect([...despues.proximas, ...despues.pasadas].some((a) => a.id === cita.id)).toBe(true);
  });
});

describe("avisos al paciente", () => {
  it("tarea, cita y escala nuevas dejan un aviso para el paciente", async () => {
    await como(pro, () => ok(createTaskAction({ patientId, title: "Tarea con aviso" })));
    await como(pro, () => ok(createAppointmentAction({ patientId, startsAt: enHoras(60), endsAt: enHoras(61), freq: "none" })));
    const escala = (await como(pro, getScaleCatalog))[0]!;
    await como(pro, () => ok(createScaleAssignmentAction({ patientId, scaleId: escala.id, type: "one_off" })));
    const { data } = await admin().from("notifications").select("type").eq("user_id", paciente.id);
    const tipos = new Set((data ?? []).map((n) => n.type));
    expect(tipos.has("new_task")).toBe(true);
    expect(tipos.has("appointment_created")).toBe(true);
    expect(tipos.has("new_scale")).toBe(true);
  });
});

describe("diario", () => {
  it("si el paciente borra su registro de hoy, desaparece de la ficha", async () => {
    await como(paciente, () => ok(addMoodEntryAction(2, "Lo borro luego")));
    const mio = (await como(paciente, getMyMoodEntries)).find((e) => e.note === "Lo borro luego")!;
    await como(paciente, () => ok(deleteMoodEntryAction(mio.id)));
    expect((await como(pro, () => getRecentMoodEntries(patientId))).some((e) => e.id === mio.id)).toBe(false);
  });
});

describe("centro con varios profesionales", () => {
  let colaborador: Actor;

  beforeAll(async () => {
    colaborador = await nuevoUsuario("professional", "Colaboradora Ficticia");
    // Alta del colaborador en el centro del titular. Se hace con service_role
    // porque el camino real es una invitación por correo; lo que se prueba es
    // lo que viene DESPUÉS: el reparto del expediente.
    const { data: exp } = await admin().from("patients").select("organization_id").eq("id", patientId).single();
    const { error } = await admin()
      .from("organization_members")
      .insert({ organization_id: exp!.organization_id!, professional_id: await proId(colaborador), role: "member" });
    if (error) throw new Error(error.message);
    const r = await pro.db.rpc("assign_patient", { p_patient_id: patientId, p_professional_id: await proId(colaborador) });
    if (r.error) throw new Error(r.error.message);
  });

  it("el colaborador asignado ve las tareas del expediente", async () => {
    const tareas = await como(colaborador, () => getTasksForPatient(patientId));
    expect(tareas.some((t) => t.title === "Tarea con aviso")).toBe(true);
  });

  it("[H3] el colaborador asignado ve las solicitudes de cita del paciente", async () => {
    await como(paciente, () =>
      ok(requestAppointmentAction({ kind: "new", preferredStart: enHoras(24 * 15), durationMin: 50, note: "Para el centro" })),
    );
    // La titular sí la ve…
    expect((await como(pro, () => getRequestsForProfessional("pending"))).some((r) => r.note === "Para el centro")).toBe(true);
    // …el colaborador, que también lleva el caso, no: filtra por profesional de referencia.
    expect(await como(colaborador, countPendingRequests)).toBeGreaterThan(0);
  });

  it("[H3] el colaborador asignado puede ACEPTAR la solicitud; la cita va a su agenda y llega al paciente", async () => {
    const r = (await como(colaborador, () => getRequestsForProfessional("pending"))).find((x) => x.note === "Para el centro")!;
    await como(colaborador, () => ok(resolveRequestAction({ id: r.id, action: "accept" })));
    const { data: cita } = await admin()
      .from("appointments")
      .select("professional_id, starts_at")
      .eq("patient_id", patientId)
      .eq("starts_at", r.preferred_start!)
      .single();
    expect(cita?.professional_id).toBe(await proId(colaborador));
    expect(await como(pro, countPendingRequests)).toBe(0);
  });

  it("[H3] el colaborador asignado crea una tarea desde la ficha y el paciente la recibe", async () => {
    await como(colaborador, () => ok(createTaskAction({ patientId, title: "Tarea de la colaboradora" })));
    const tareas = await como(paciente, () => getTasksForPatient(patientId));
    expect(tareas.some((t) => t.title === "Tarea de la colaboradora")).toBe(true);
  });

  it("[H3] el colaborador asignado tiene al paciente en su listado", async () => {
    const lista = await como(colaborador, () => listPatientsWithOverview({ status: "active" } as never));
    expect(JSON.stringify(lista)).toContain(patientId);
  });
});

describe("una cuenta con expedientes en dos consultas", () => {
  it("[H4] la app del paciente sigue funcionando con dos expedientes", async () => {
    const otraConsulta = await nuevoUsuario("professional", "Otra Consulta");
    await vincular(otraConsulta, paciente, "Paciente Límite (otra consulta)");
    // `getCurrentPatient` hace `.maybeSingle()` sobre `user_id`: con dos filas
    // PostgREST devuelve error y todas las pantallas de /app caen en error.tsx.
    await expect(como(paciente, getCurrentPatient)).resolves.not.toBeNull();
  });
});
