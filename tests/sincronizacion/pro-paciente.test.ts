/*
 * Sincronización panel del profesional ⇄ app del paciente, de punta a punta.
 *
 * Cada caso escribe con la SERVER ACTION real de un lado y lee con la CONSULTA
 * real que pinta la pantalla del otro, con sesiones reales de Supabase Auth y
 * la RLS de PostgREST. Si una consulta filtra de más, si una política no deja
 * leer o si una acción escribe donde la otra pantalla no mira, falla aquí.
 *
 * Lo que esta prueba NO cubre, y lo dice: que una pantalla YA ABIERTA en el
 * otro dispositivo se refresque sola. No lo hace —no hay tiempo real ni
 * refresco al volver al primer plano—; ver docs/SINCRONIZACION.md.
 */
import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { actuarComo, admin, nuevoUsuario, type Actor } from "./actores";

import type { ActionResult } from "@/lib/action-result";
import { createPatientAction, setPatientStatusAction, updatePatientDetailsAction } from "@/lib/actions/patients";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { completeTaskAction } from "@/lib/actions/patient-tasks";
import {
  cancelAppointmentAction,
  createAppointmentAction,
  deleteAppointmentAction,
  requestAppointmentAction,
  resolveRequestAction,
  respondAppointmentAction,
  setAttendanceAction,
  updateAppointmentAction,
  withdrawRequestAction,
} from "@/lib/actions/appointments";
import { createScaleAssignmentAction, setScaleAssignmentActiveAction } from "@/lib/actions/scales";
import { submitScaleResponseAction } from "@/lib/actions/scale-responses";
import { addPackAction, registerPaymentAction, setPaymentStatusAction, upsertPriceAction } from "@/lib/actions/payments";
import { addResourceFileAction, addResourceLinkAction, deleteResourceAction } from "@/lib/actions/resources";
import { addDocumentAction, setDocumentSharedAction } from "@/lib/actions/documents";
import { prepareUploadAction } from "@/lib/actions/uploads";
import { addMoodEntryAction } from "@/lib/actions/mood";
import { addNoteAction } from "@/lib/actions/notes";
import {
  guardarMedicamentoAction,
  setRetiradoMedicamentoAction,
  setSituacionMedicacionAction,
  setVisibilidadMedicacionAction,
} from "@/lib/actions/medicacion";

import { getCurrentPatient } from "@/lib/queries/identity";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getMyAppointmentsSplit } from "@/lib/queries/appointments";
import { getPatientAppointments, getRecentMoodEntries, getScaleAssignments, getUpcomingAppointments } from "@/lib/queries/patient-detail";
import { countPendingRequests, getMyRequests, getRequestsForProfessional } from "@/lib/queries/appointment-requests";
import { getMyActiveAssignments, getScaleCatalog } from "@/lib/queries/scales";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { getMyDocuments, getMyMoodEntries, getMyResources } from "@/lib/queries/wellbeing";
import { getMiMedicacion } from "@/lib/queries/medicacion";
import { listPatientsWithOverview } from "@/lib/queries/patients";
import { hasSignedConsent } from "@/lib/queries/consent";
import { fromWallClock, ymdInTZ, ymdParts } from "@/lib/tz";

let pro: Actor;
let paciente: Actor;
let patientId: string;

/** Desenvuelve el resultado de una server action; si falló, la prueba falla con su mensaje. */
async function ok<T>(p: Promise<ActionResult<T>>): Promise<T> {
  const r = await p;
  if (!r.success) throw new Error(`La acción falló: ${r.error}`);
  return r.data;
}
async function falla<T>(p: Promise<ActionResult<T>>): Promise<string> {
  const r = await p;
  if (r.success) throw new Error("La acción debía fallar y no falló");
  return r.error;
}
async function como<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  actuarComo(actor);
  return fn();
}
const enHoras = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

beforeAll(async () => {
  pro = await nuevoUsuario("professional", "Dra. Sincronía Ficticia");
  paciente = await nuevoUsuario("patient", "Paciente de Prueba");

  // Alta del expediente con la acción real del panel.
  await como(pro, async () => {
    const fd = new FormData();
    fd.set("full_name", "Paciente de Prueba");
    fd.set("email", paciente.email);
    // En producción termina con `redirect()` a la ficha: eso es el éxito.
    await createPatientAction(fd).then(
      (r) => {
        if (!r.success) throw new Error(r.error);
      },
      (e: unknown) => {
        if (!(e instanceof Error) || e.message !== "NEXT_REDIRECT") throw e;
      },
    );
  });
  const { data: fila, error } = await pro.db
    .from("patients")
    .select("id")
    .eq("email", paciente.email)
    .single();
  if (error) throw new Error(error.message);
  patientId = fila.id;

  // Invitación y alta del paciente por el camino real: token → consentimiento.
  const token = randomUUID();
  const inv = await pro.db.rpc("issue_invitation", { p_patient_id: patientId, p_token_hash: sha(token) });
  if (inv.error) throw new Error(inv.error.message);
  const c = await paciente.db.rpc("get_onboarding_consent", { p_token: token });
  if (c.error) throw new Error(c.error.message);
  const consent = c.data as { id: string; hash: string };
  const fin = await paciente.db.rpc("complete_onboarding", {
    p_token: token,
    p_template_id: consent.id,
    p_content_hash: consent.hash,
  });
  if (fin.error) throw new Error(fin.error.message);
});

describe("ficha del paciente", () => {
  it("el paciente queda vinculado y se ve a sí mismo", async () => {
    const yo = await como(paciente, getCurrentPatient);
    expect(yo?.id).toBe(patientId);
  });

  it("el nombre que corrige el profesional es el que saluda al paciente", async () => {
    await como(pro, async () => {
      const fd = new FormData();
      fd.set("full_name", "Paciente Renombrada");
      fd.set("email", paciente.email);
      await ok(updatePatientDetailsAction(patientId, fd));
    });
    const yo = await como(paciente, getCurrentPatient);
    expect(yo?.full_name).toBe("Paciente Renombrada");
  });
});

describe("tareas", () => {
  let taskId: string;

  it("crear: aparece en el inicio del paciente", async () => {
    await como(pro, () => ok(createTaskAction({ patientId, title: "Registro de pensamientos", description: "Tres al día" })));
    const tareas = await como(paciente, () => getTasksForPatient(patientId));
    const t = tareas.find((x) => x.title === "Registro de pensamientos");
    expect(t, "la tarea creada no llega al paciente").toBeDefined();
    expect(t!.description).toBe("Tres al día");
    expect(t!.completed).toBe(false);
    taskId = t!.id;
  });

  it("editar: el paciente ve el título y la fecha nuevos", async () => {
    await como(pro, () =>
      ok(updateTaskAction({ taskId, patientId, title: "Registro de pensamientos (v2)", dueDate: "2030-01-15" })),
    );
    const t = (await como(paciente, () => getTasksForPatient(patientId))).find((x) => x.id === taskId);
    expect(t?.title).toBe("Registro de pensamientos (v2)");
    expect(t?.due_date).toBe("2030-01-15");
  });

  it("completar (paciente): el profesional la ve hecha y con la respuesta", async () => {
    await como(paciente, () => ok(completeTaskAction(taskId, "Hecho, me costó el martes")));
    const t = (await como(pro, () => getTasksForPatient(patientId))).find((x) => x.id === taskId);
    expect(t?.completed).toBe(true);
    expect(t?.lastCompletion?.response_text).toBe("Hecho, me costó el martes");
  });

  it("borrar: desaparece de la app del paciente", async () => {
    await como(pro, () => ok(createTaskAction({ patientId, title: "Tarea efímera" })));
    const efimera = (await como(pro, () => getTasksForPatient(patientId))).find((x) => x.title === "Tarea efímera")!;
    await como(pro, () => ok(deleteTaskAction(efimera.id, patientId)));
    const tareas = await como(paciente, () => getTasksForPatient(patientId));
    expect(tareas.some((x) => x.id === efimera.id)).toBe(false);
  });
});

describe("citas", () => {
  let citaId: string;
  const inicio = enHoras(48);
  const fin = enHoras(49);

  it("crear: aparece como próxima en el inicio y en Citas del paciente", async () => {
    await como(pro, () =>
      ok(createAppointmentAction({ patientId, startsAt: inicio, endsAt: fin, freq: "none", videoLink: "https://meet.example.com/abc" })),
    );
    const [proximas, split] = await como(paciente, () =>
      Promise.all([getUpcomingAppointments(patientId), getMyAppointmentsSplit()]),
    );
    const cita = proximas.find((a) => a.starts_at === inicio || new Date(a.starts_at).getTime() === new Date(inicio).getTime());
    expect(cita, "la cita creada no llega al inicio del paciente").toBeDefined();
    expect(split.upcoming.some((a) => a.id === cita!.id)).toBe(true);
    expect(cita!.video_link).toBe("https://meet.example.com/abc");
    citaId = cita!.id;
  });

  it("confirmar (paciente): el profesional la ve confirmada en la ficha", async () => {
    await como(paciente, () => ok(respondAppointmentAction(citaId, "confirm")));
    const { proximas } = await como(pro, () => getPatientAppointments(patientId));
    expect(proximas.find((a) => a.id === citaId)?.status).toBe("confirmed");
  });

  it("mover (profesional): el paciente ve la hora nueva", async () => {
    const nuevoInicio = enHoras(72);
    await como(pro, () =>
      ok(updateAppointmentAction({ id: citaId, patientId, startsAt: nuevoInicio, endsAt: enHoras(73) })),
    );
    const cita = (await como(paciente, getMyAppointmentsSplit)).upcoming.find((a) => a.id === citaId);
    expect(new Date(cita!.starts_at).getTime()).toBe(new Date(nuevoInicio).getTime());
  });

  it("asistencia en una cita futura: el servidor la rechaza", async () => {
    const error = await como(pro, () => falla(setAttendanceAction(citaId, "attended")));
    expect(error).toMatch(/ya ha empezado/);
  });

  it("cancelar (profesional): el paciente la ve cancelada", async () => {
    await como(pro, () => ok(cancelAppointmentAction(citaId)));
    const todas = await como(paciente, getMyAppointmentsSplit);
    const cita = [...todas.upcoming, ...todas.past].find((a) => a.id === citaId);
    expect(cita?.status).toBe("cancelled");
    // Y el inicio no la anuncia como próxima.
    const proximas = await como(paciente, () => getUpcomingAppointments(patientId));
    expect(proximas.some((a) => a.id === citaId)).toBe(false);
  });

  it("cancelar (paciente): el profesional la ve cancelada", async () => {
    await como(pro, () => ok(createAppointmentAction({ patientId, startsAt: enHoras(96), endsAt: enHoras(97), freq: "none" })));
    const otra = (await como(paciente, getMyAppointmentsSplit)).upcoming.find(
      (a) => new Date(a.starts_at).getTime() > Date.now() + 95 * 3_600_000,
    )!;
    await como(paciente, () => ok(respondAppointmentAction(otra.id, "cancel")));
    const { proximas, pasadas } = await como(pro, () => getPatientAppointments(patientId));
    expect([...proximas, ...pasadas].find((a) => a.id === otra.id)?.status ?? "fuera de las listas de la ficha").not.toBe("confirmed");
    const { data } = await pro.db.from("appointments").select("status").eq("id", otra.id).single();
    expect(data?.status).toBe("cancelled");
  });

  // [H0, corregido el 6-oct] Crear una serie fallaba siempre: el insert en
  // bloque mandaba las repeticiones con id NULL.
  it("[H0] serie semanal: el paciente recibe todas las repeticiones, a la misma hora de Madrid", async () => {
    const base = new Date(Date.now() + 10 * 86_400_000);
    base.setUTCHours(9, 0, 0, 0);
    // «Hasta» como lo manda el formulario (NewAppointment): 23:59 de ese día en Madrid.
    const [y, m, d] = ymdParts(ymdInTZ(new Date(base.getTime() + 21 * 86_400_000)));
    await como(pro, () =>
      ok(createAppointmentAction({
        patientId,
        startsAt: base.toISOString(),
        endsAt: new Date(base.getTime() + 3_600_000).toISOString(),
        freq: "weekly",
        until: fromWallClock(y, m, d, 23, 59).toISOString(),
      })),
    );
    const proximas = (await como(paciente, getMyAppointmentsSplit)).upcoming;
    const madre = proximas.find((a) => new Date(a.starts_at).getTime() === base.getTime())!;
    expect(madre, "la cita madre de la serie no llega al paciente").toBeDefined();
    const serie = proximas.filter((a) => a.id === madre.id || a.parent_appointment_id === madre.id);
    expect(serie.length).toBe(4);
    // La hora de pared en Madrid se conserva aunque cambie el horario de verano.
    const horaMadrid = (iso: string) =>
      new Date(iso).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
    expect(new Set(serie.map((a) => horaMadrid(a.starts_at))).size).toBe(1);
  });

  it("serie con «hasta» como día suelto: incluye la repetición de ese día", async () => {
    const base = new Date(Date.now() + 40 * 86_400_000);
    base.setUTCHours(15, 0, 0, 0);
    await como(pro, () =>
      ok(createAppointmentAction({
        patientId,
        startsAt: base.toISOString(),
        endsAt: new Date(base.getTime() + 3_600_000).toISOString(),
        freq: "biweekly",
        until: ymdInTZ(new Date(base.getTime() + 14 * 86_400_000)),
      })),
    );
    const proximas = (await como(paciente, getMyAppointmentsSplit)).upcoming;
    const madre = proximas.find((a) => new Date(a.starts_at).getTime() === base.getTime())!;
    expect(proximas.filter((a) => a.id === madre.id || a.parent_appointment_id === madre.id).length).toBe(2);
  });

  it("borrar (profesional): desaparece de la app del paciente", async () => {
    await como(pro, () => ok(deleteAppointmentAction(citaId)));
    const todas = await como(paciente, getMyAppointmentsSplit);
    expect([...todas.upcoming, ...todas.past].some((a) => a.id === citaId)).toBe(false);
  });

  it("asistencia en una cita ya empezada: acudió y vuelta a pendiente", async () => {
    // Una cita que empezó hace una hora, insertada como el profesional (la
    // acción de crear no deja citas en el pasado).
    const { data: prof } = await pro.db.from("professionals").select("id").eq("user_id", pro.id).single();
    const { data: pasada, error } = await pro.db
      .from("appointments")
      .insert({ professional_id: prof!.id, patient_id: patientId, starts_at: enHoras(-1), ends_at: enHoras(0) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await como(pro, () => ok(upsertPriceAction(patientId, 60)));
    await como(pro, () => ok(setAttendanceAction(pasada!.id, "attended")));
    const resumen = await como(paciente, getMyPaymentSummary);
    expect(resumen.debtCents, "la sesión atendida no genera la deuda que ve el paciente").toBeGreaterThanOrEqual(6000);
    await como(pro, () => ok(setAttendanceAction(pasada!.id, "pending")));
    const despues = await como(paciente, getMyPaymentSummary);
    expect(despues.debtCents).toBe(resumen.debtCents - 6000);
  });
});

describe("solicitudes de cita", () => {
  it("pedir (paciente) → el profesional la ve y suma en el contador", async () => {
    const antes = await como(pro, countPendingRequests);
    await como(paciente, () =>
      ok(requestAppointmentAction({ kind: "new", preferredStart: enHoras(24 * 14), durationMin: 50, note: "Mejor por la tarde" })),
    );
    const pendientes = await como(pro, () => getRequestsForProfessional("pending"));
    expect(pendientes.some((r) => r.note === "Mejor por la tarde")).toBe(true);
    expect(await como(pro, countPendingRequests)).toBe(antes + 1);
  });

  it("aceptar (profesional) → el paciente tiene la cita y la solicitud resuelta", async () => {
    const r = (await como(pro, () => getRequestsForProfessional("pending"))).find((x) => x.note === "Mejor por la tarde")!;
    await como(pro, () => ok(resolveRequestAction({ id: r.id, action: "accept" })));
    const mias = await como(paciente, getMyRequests);
    expect(mias.pending.some((x) => x.id === r.id)).toBe(false);
    const citas = await como(paciente, getMyAppointmentsSplit);
    expect(citas.upcoming.some((a) => new Date(a.starts_at).getTime() === new Date(r.preferred_start!).getTime())).toBe(true);
  });

  it("retirar (paciente) → desaparece de las pendientes del profesional", async () => {
    const id = await como(paciente, () =>
      ok(requestAppointmentAction({ kind: "new", preferredStart: enHoras(24 * 20), durationMin: 50, note: "La retiro" })),
    );
    await como(paciente, () => ok(withdrawRequestAction(id)));
    const pendientes = await como(pro, () => getRequestsForProfessional("pending"));
    expect(pendientes.some((r) => r.id === id)).toBe(false);
  });
});

describe("escalas (opt-in)", () => {
  let asignacion: string;

  it("sin activar, el paciente no tiene ninguna", async () => {
    expect(await como(paciente, getMyActiveAssignments)).toEqual([]);
  });

  it("activar (profesional) → aparece en el inicio del paciente", async () => {
    const catalogo = await como(pro, getScaleCatalog);
    const gad = catalogo.find((s) => s.code.startsWith("GAD")) ?? catalogo[0]!;
    await como(pro, () => ok(createScaleAssignmentAction({ patientId, scaleId: gad.id, type: "one_off" })));
    const mias = await como(paciente, getMyActiveAssignments);
    expect(mias.length).toBe(1);
    asignacion = mias[0]!.id;
  });

  it("responder (paciente) → el profesional ve puntuación; el paciente deja de tenerla pendiente", async () => {
    const mias = await como(paciente, getMyActiveAssignments);
    const a = mias[0]!;
    const { data: escala } = await admin().from("scales").select("definition").eq("id", a.scaleId).single();
    const items = (escala!.definition as { items: { id: number | string }[] }).items;
    const answers = Object.fromEntries(items.map((i) => [String(i.id), 1]));
    await como(paciente, () => ok(submitScaleResponseAction({ assignmentId: a.id, scaleId: a.scaleId, answers })));
    const vistas = await como(pro, () => getScaleAssignments(patientId));
    const v = vistas.find((x) => x.id === asignacion) as unknown as Record<string, unknown>;
    expect(JSON.stringify(v)).toContain(String(items.length)); // puntuación = nº de ítems × 1
    expect((await como(paciente, getMyActiveAssignments)).some((x) => x.id === asignacion)).toBe(false);
  });

  it("desactivar (profesional) → una recurrente desaparece del paciente", async () => {
    const catalogo = await como(pro, getScaleCatalog);
    const phq = catalogo.find((s) => s.code.startsWith("PHQ")) ?? catalogo[0]!;
    await como(pro, () => ok(createScaleAssignmentAction({ patientId, scaleId: phq.id, type: "recurring", intervalDays: 7 })));
    const rec = (await como(paciente, getMyActiveAssignments)).find((x) => x.scaleId === phq.id)!;
    expect(rec).toBeDefined();
    await como(pro, () => ok(setScaleAssignmentActiveAction(rec.id, patientId, false)));
    expect((await como(paciente, getMyActiveAssignments)).some((x) => x.id === rec.id)).toBe(false);
  });
});

describe("pagos y bonos", () => {
  it("pago pendiente → el paciente ve la deuda; marcado como cobrado → desaparece", async () => {
    const antes = (await como(paciente, getMyPaymentSummary)).debtCents;
    await como(pro, () => ok(registerPaymentAction(patientId, 45, "pending")));
    const conDeuda = await como(paciente, getMyPaymentSummary);
    expect(conDeuda.debtCents).toBe(antes + 4500);
    const pago = conDeuda.payments.find((p) => p.amount_cents === 4500 && p.status === "pending")!;
    await como(pro, () => ok(setPaymentStatusAction(pago.id, patientId, "paid")));
    expect((await como(paciente, getMyPaymentSummary)).debtCents).toBe(antes);
  });

  it("bono → el paciente ve las sesiones disponibles", async () => {
    const antes = (await como(paciente, getMyPaymentSummary)).packRemaining;
    await como(pro, () => ok(addPackAction(patientId, 5, 250)));
    expect((await como(paciente, getMyPaymentSummary)).packRemaining).toBe(antes + 5);
  });
});

describe("recursos y documentos", () => {
  it("enlace para el paciente → lo ve en Recursos; borrado → desaparece", async () => {
    await como(pro, () => ok(addResourceLinkAction({ patientId, title: "Respiración 4-7-8", url: "https://example.com/respira" })));
    const rec = (await como(paciente, getMyResources)).find((r) => r.title === "Respiración 4-7-8");
    expect(rec, "el recurso no llega al paciente").toBeDefined();
    await como(pro, () => ok(deleteResourceAction(rec!.id, patientId)));
    expect((await como(paciente, getMyResources)).some((r) => r.id === rec!.id)).toBe(false);
  });

  it("enlace general (para todos) → también lo ve este paciente", async () => {
    await como(pro, () => ok(addResourceLinkAction({ patientId: null, title: "Guía general", url: "https://example.com/guia" })));
    expect((await como(paciente, getMyResources)).some((r) => r.title === "Guía general")).toBe(true);
  });

  /** Reserva + PUT real a Storage, como `src/lib/upload-client.ts`. */
  async function subirPdf(): Promise<string> {
    const archivo = new File(["%PDF-1.4 informe ficticio"], "informe.pdf", { type: "application/pdf" });
    const subida = await como(pro, () =>
      ok(prepareUploadAction({ bucket: "files", patientId, size: archivo.size, mime: archivo.type })),
    );
    const put = await pro.db.storage
      .from("files")
      .uploadToSignedUrl(subida.path, subida.token, archivo, { contentType: archivo.type });
    if (put.error) throw new Error(put.error.message);
    return subida.path;
  }

  // [H5, corregido el 6-oct] `requireUploadedFile` leía solo `metadata`, que
  // Storage ya no rellena, y rechazaba toda subida.
  it("documento: el alta por la acción real acepta una subida válida y el paciente lo ve al compartirlo", async () => {
    const ruta = await subirPdf();
    await como(pro, async () => {
      const fd = new FormData();
      fd.set("patientId", patientId);
      fd.set("title", "Informe subido");
      fd.set("file_path", ruta);
      await ok(addDocumentAction(fd));
    });
    const { data: doc } = await pro.db.from("documents").select("id").eq("storage_path", ruta).single();
    expect(doc, "la acción no registró el documento").not.toBeNull();
    await como(pro, () => ok(setDocumentSharedAction(doc!.id, patientId, true)));
    expect((await como(paciente, getMyDocuments)).some((d) => d.title === "Informe subido")).toBe(true);
  });

  it("recurso en archivo: la subida real llega a Recursos del paciente", async () => {
    const ruta = await subirPdf();
    await como(pro, async () => {
      const fd = new FormData();
      fd.set("patientId", patientId);
      fd.set("title", "Guía en PDF");
      fd.set("kind", "pdf");
      fd.set("file_path", ruta);
      await ok(addResourceFileAction(fd));
    });
    expect((await como(paciente, getMyResources)).some((r) => r.title === "Guía en PDF")).toBe(true);
  });

  it("documento: solo lo ve (y lo descarga) si el profesional lo comparte", async () => {
    // Fila registrada directamente tras una subida real: aquí lo que se prueba
    // es la compartición, también del archivo en Storage.
    const ruta = await subirPdf();
    const { data: doc, error } = await pro.db
      .from("documents")
      .insert({ professional_id: (await pro.db.from("professionals").select("id").eq("user_id", pro.id).single()).data!.id, patient_id: patientId, title: "Informe.pdf", storage_path: ruta })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    expect((await como(paciente, getMyDocuments)).some((d) => d.id === doc!.id)).toBe(false);
    expect((await paciente.db.storage.from("files").createSignedUrl(ruta, 60)).error).not.toBeNull();
    await como(pro, () => ok(setDocumentSharedAction(doc!.id, patientId, true)));
    expect((await como(paciente, getMyDocuments)).some((d) => d.id === doc!.id)).toBe(true);
    expect((await paciente.db.storage.from("files").createSignedUrl(ruta, 60)).error).toBeNull();
    await como(pro, () => ok(setDocumentSharedAction(doc!.id, patientId, false)));
    expect((await como(paciente, getMyDocuments)).some((d) => d.id === doc!.id)).toBe(false);
    expect(
      (await paciente.db.storage.from("files").createSignedUrl(ruta, 60)).error,
      "dejar de compartir no corta el acceso al archivo",
    ).not.toBeNull();
  });
});

describe("diario emocional", () => {
  it("registro del paciente → el profesional lo ve en la ficha, con su escala", async () => {
    await como(paciente, () => ok(addMoodEntryAction(3, "Día tranquilo")));
    const entradas = await como(pro, () => getRecentMoodEntries(patientId));
    const hoy = entradas.find((e) => e.note === "Día tranquilo");
    expect(hoy, "el registro del paciente no llega a la ficha").toBeDefined();
    expect(hoy!.mood_value).toBe(3);
    expect(hoy!.mood_scale).toBe(4);
    expect((await como(paciente, getMyMoodEntries)).some((e) => e.note === "Día tranquilo")).toBe(true);
  });
});

describe("medicación", () => {
  const datos = {
    nombre: "Fármaco ficticio",
    dosis: "1 comprimido",
    momentos: ["manana" as const],
    frecuencia: "diaria" as const,
    con_comida: "con_comida" as const,
    prescrito_por: "Dra. Ficticia",
  };

  it("apagado: el paciente no ve nada aunque haya pauta", async () => {
    await como(pro, () => ok(guardarMedicamentoAction({ patientId, datos })));
    expect(await como(paciente, getMiMedicacion)).toBeNull();
  });

  it("activado: ve la pauta y la situación «con pauta» que puso el alta", async () => {
    await como(pro, () => ok(setVisibilidadMedicacionAction(patientId, true)));
    const mia = await como(paciente, getMiMedicacion);
    expect(mia?.requiere_medicacion).toBe(true);
    expect(mia?.medicamentos.map((m) => m.nombre)).toEqual(["Fármaco ficticio"]);
  });

  it("editar la dosis → el paciente ve la nueva", async () => {
    const id = (await como(paciente, getMiMedicacion))!.medicamentos[0]!.id;
    await como(pro, () => ok(guardarMedicamentoAction({ patientId, id, datos: { ...datos, dosis: "2 comprimidos" } })));
    expect((await como(paciente, getMiMedicacion))!.medicamentos[0]!.dosis).toBe("2 comprimidos");
  });

  it("retirar → desaparece de la app; volver a la pauta → reaparece", async () => {
    const id = (await como(paciente, getMiMedicacion))!.medicamentos[0]!.id;
    await como(pro, () => ok(setRetiradoMedicamentoAction({ patientId, id, retirado: true })));
    expect((await como(paciente, getMiMedicacion))!.medicamentos).toEqual([]);
    await como(pro, () => ok(setRetiradoMedicamentoAction({ patientId, id, retirado: false })));
    expect((await como(paciente, getMiMedicacion))!.medicamentos.length).toBe(1);
  });

  it("situación «no requiere» → el paciente la ve", async () => {
    await como(pro, () => ok(setSituacionMedicacionAction(patientId, false)));
    expect((await como(paciente, getMiMedicacion))?.requiere_medicacion).toBe(false);
  });

  it("apagar → vuelve a no ver nada", async () => {
    await como(pro, () => ok(setVisibilidadMedicacionAction(patientId, false)));
    expect(await como(paciente, getMiMedicacion)).toBeNull();
  });
});

describe("lo que NO debe cruzar", () => {
  it("las notas privadas del profesional no llegan al paciente", async () => {
    await como(pro, () => ok(addNoteAction(patientId, "Nota clínica privada")));
    const { data } = await paciente.db.from("patient_notes").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("el paciente no ve el expediente ni las tareas de otro paciente", async () => {
    const otro = await nuevoUsuario("patient", "Otro paciente");
    actuarComo(otro);
    expect(await getCurrentPatient()).toBeNull();
    expect(await getTasksForPatient(patientId)).toEqual([]);
  });
});

describe("archivar", () => {
  it("el listado del profesional lo mueve a archivados", async () => {
    await como(pro, () => ok(setPatientStatusAction(patientId, "archived")));
    const activos = await como(pro, () => listPatientsWithOverview({ status: "active" } as never));
    expect(JSON.stringify(activos)).not.toContain(patientId);
  });

  it("el paciente archivado pierde el acceso: la app lo saca y la base no le da datos", async () => {
    // `getCurrentPatient` sigue resolviendo la fila (lee por user_id), pero el
    // layout de /app exige `has_current_consent()`, que pide expediente activo,
    // y la RLS clínica usa `current_patient_ids()`, que también.
    expect(await como(paciente, () => hasSignedConsent())).toBe(false);
    expect(await como(paciente, () => getTasksForPatient(patientId))).toEqual([]);
    expect(await como(paciente, getMiMedicacion)).toBeNull();
  });

  it("reactivar devuelve el acceso con todo lo anterior", async () => {
    await como(pro, () => ok(setPatientStatusAction(patientId, "active")));
    expect(await como(paciente, () => hasSignedConsent())).toBe(true);
    expect((await como(paciente, () => getTasksForPatient(patientId))).length).toBeGreaterThan(0);
  });
});
