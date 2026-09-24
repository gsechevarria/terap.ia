import Link from "next/link";
import { addDaysYMD, formatYMD, parseYMD, todayYMD, ymdInTZ } from "@/lib/tz";
import { notFound } from "next/navigation";
import { getPatient } from "@/lib/queries/patients";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getNotesForPatient } from "@/lib/queries/notes";
import { getAccesoPaciente } from "@/lib/queries/invitations";
import {
  getDocuments,
  getRecentMoodEntries,
  getScaleAssignments,
  getPatientAppointments,
} from "@/lib/queries/patient-detail";
import type { Appointment } from "@/lib/types";
import {
  getScaleCatalog,
  getUnacknowledgedFlagged,
} from "@/lib/queries/scales";
import { getPatientPaymentDetail } from "@/lib/queries/payments";
import { getProfessionalResources } from "@/lib/queries/wellbeing";
import { ScalesPanel } from "@/app/pro/_components/ScalesPanel";
import { PaymentsPanel } from "@/app/pro/_components/PaymentsPanel";
import { ResourcesPanel } from "@/app/pro/_components/ResourcesPanel";
import { DocumentsPanel } from "@/app/pro/_components/DocumentsPanel";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import {
  ageFromBirthDate,
  formatDate,
  formatDateTime,
  formatTime,
  nombreDelDia,
} from "@/lib/format";
import { Migas } from "@/app/pro/_components/Migas";
import { Status, type StatusTone } from "@/components/ui/Status";
import { StatusButton } from "@/app/pro/_components/StatusButton";
import { TagsEditor } from "@/app/pro/_components/TagsEditor";
import { InvitePanel } from "@/app/pro/_components/InvitePanel";
import { AsignacionesPanel } from "@/app/pro/_components/AsignacionesPanel";
import { getAsignaciones, getMiembros } from "@/lib/queries/organizations";
import { getContextoPropio } from "@/lib/queries/contexts";
import { ESCALA_ACTUAL, etiquetaAnimo } from "@/lib/diario";
import { TasksPanel } from "@/app/pro/_components/TasksPanel";
import { NotesPanel } from "@/app/pro/_components/NotesPanel";
import { PatientDetailsPanel } from "@/app/pro/_components/PatientDetailsPanel";
import { FlaggedAlerts } from "@/app/pro/_components/FlaggedAlerts";

const TABS = [
  { key: "informacion", label: "Información" },
  { key: "tareas", label: "Tareas" },
  { key: "notas", label: "Notas" },
  { key: "escalas", label: "Escalas" },
  { key: "citas", label: "Citas" },
  { key: "pagos", label: "Pagos" },
  { key: "diario", label: "Diario" },
  { key: "recursos", label: "Recursos" },
  { key: "documentos", label: "Documentos" },
  { key: "invitacion", label: "Acceso y equipo" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function diasEntre(desdeYMD: string, hastaYMD: string): number {
  return Math.round(
    (parseYMD(hastaYMD).getTime() - parseYMD(desdeYMD).getTime()) / 86_400_000
  );
}

/**
 * La frase bajo el nombre, como la de «Hoy»: lo que hace falta saber del
 * paciente antes de abrir ninguna pestaña. Solo hechos del expediente —citas,
 * tareas, cuenta—; nada clínico.
 */
function fraseDelExpediente({
  proxima,
  ultimaSesion,
  tareasPendientes,
  tieneCuenta,
  archivado,
  hoy,
}: {
  proxima: string | null;
  ultimaSesion: string | null;
  tareasPendientes: number;
  tieneCuenta: boolean;
  archivado: boolean;
  hoy: string;
}): string {
  const partes: string[] = [];
  if (archivado) partes.push("Expediente archivado.");
  if (proxima) {
    const dias = diasEntre(hoy, ymdInTZ(new Date(proxima)));
    partes.push(
      `Próxima cita ${nombreDelDia(proxima, dias) || "hoy"}, a las ${formatTime(
        proxima
      )}.`
    );
  } else if (!archivado) {
    partes.push("Sin próxima cita.");
  }
  if (ultimaSesion) {
    const dias = diasEntre(ymdInTZ(new Date(ultimaSesion)), hoy);
    partes.push(
      dias <= 0
        ? "Última sesión hoy."
        : dias === 1
        ? "Última sesión ayer."
        : `Última sesión hace ${dias} días.`
    );
  } else {
    partes.push("Todavía no ha acudido a ninguna sesión.");
  }
  if (tareasPendientes > 0) {
    partes.push(
      `${tareasPendientes} ${
        tareasPendientes === 1 ? "tarea pendiente" : "tareas pendientes"
      }.`
    );
  }
  if (!tieneCuenta) {
    partes.push(
      "Sin cuenta en la aplicación: no ve sus citas ni recibe tareas."
    );
  }
  return partes.join(" ");
}

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = (TABS.find((t) => t.key === tabRaw)?.key ??
    "informacion") as TabKey;

  const patient = await getPatient(id);
  if (!patient) notFound();

  // Independientes entre sí: en secuencia eran tres viajes encadenados. Las
  // citas y las tareas se leen aquí para la frase de la cabecera y las mismas
  // bajan a sus pestañas, que antes las pedían otra vez.
  const [acceso, flagged, asignaciones, contexto, citas, tareas] =
    await Promise.all([
      getAccesoPaciente(id, Boolean(patient.user_id)),
      getUnacknowledgedFlagged(id),
      getAsignaciones(id),
      getContextoPropio(),
      getPatientAppointments(id),
      getTasksForPatient(id),
    ]);
  // El reparto de expedientes solo tiene sentido en un centro: en una consulta
  // individual no hay con quién compartirlo.
  const esCentro = contexto?.organization_kind === "center";
  const equipo =
    esCentro && contexto?.organization_id
      ? (await getMiembros(contexto.organization_id)).map((m) => ({
          professionalId: m.professionalId,
          nombre: m.nombre ?? m.email ?? "Profesional",
        }))
      : [];

  // "Hoy" en la zona del profesional, resuelto una vez en el servidor.
  const hoy = todayYMD();
  const frase = fraseDelExpediente({
    proxima: citas.proximas[0]?.starts_at ?? null,
    ultimaSesion:
      citas.pasadas.find((c) => c.attendance === "attended")?.starts_at ?? null,
    tareasPendientes: tareas.filter((t) => !t.completed).length,
    tieneCuenta: Boolean(patient.user_id),
    archivado: patient.status === "archived",
    hoy,
  });

  // A lo ancho, como el resto del panel. Lo que necesita un ancho de lectura
  // —formularios, notas, la gráfica— lo limita cada panel, no la página.
  return (
    <div>
      <Migas
        tramos={[
          { href: "/pro/patients", texto: "Pacientes" },
          { texto: patient.full_name ?? "Sin nombre" },
        ]}
      />

      <FlaggedAlerts patientId={id} responses={flagged} />

      {/* Cabecera del expediente sin caja: va sobre la hoja y lo que la separa
          del contenido es el subrayado de las pestañas, no un borde más. */}
      <header className="mt-5 flex flex-col gap-5 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-headline-lg font-semibold text-accent"
          >
            {(patient.full_name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="page-title truncate">
              {patient.full_name ?? "Sin nombre"}
            </h1>
            <p className="mt-3 max-w-[640px] text-body-lg text-ink-2">
              {frase}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Status
                tone={patient.status === "archived" ? "neutral" : "success"}
              >
                {patient.status === "archived" ? "Archivado" : "En seguimiento"}
              </Status>
              {patient.email && (
                <span className="text-[13px] text-ink-2">{patient.email}</span>
              )}
            </div>
            <div className="mt-3">
              <TagsEditor patientId={patient.id} tags={patient.tags} />
            </div>
          </div>
        </div>
        <StatusButton patientId={patient.id} status={patient.status} />
      </header>

      <div className="min-w-0">
        {/* Pestañas */}
        <nav className="tabs" aria-label="Secciones del expediente">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/pro/patients/${id}?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`tab${tab === t.key ? " tab-active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="mt-7">
          {tab === "informacion" && (
            <PatientDetailsPanel
              patientId={id}
              age={ageFromBirthDate(patient.birth_date)}
              details={{
                full_name: patient.full_name,
                email: patient.email,
                phone: patient.phone,
                birth_date: patient.birth_date,
                address: patient.address,
                profession: patient.profession,
                emergency_contact: patient.emergency_contact,
              }}
            />
          )}
          {tab === "tareas" && (
            <TasksPanel
              patientId={id}
              tasks={tareas}
              today={hoy}
              soon={formatYMD(addDaysYMD(parseYMD(hoy), 2))}
            />
          )}
          {tab === "notas" && (
            <NotesPanel patientId={id} notes={await getNotesForPatient(id)} />
          )}
          {tab === "escalas" && <ScalesTab patientId={id} />}
          {tab === "citas" && <AppointmentsTab patientId={id} citas={citas} />}
          {tab === "pagos" && <PaymentsTab patientId={id} />}
          {tab === "diario" && <DiaryTab patientId={id} />}
          {tab === "recursos" && <ResourcesTab patientId={id} />}
          {tab === "documentos" && <DocumentsTab patientId={id} />}
          {tab === "invitacion" && (
            <div className="flex max-w-xl flex-col gap-8">
              <InvitePanel
                patientId={id}
                acceso={acceso}
                emailFicha={patient.email}
              />
              <AsignacionesPanel
                patientId={id}
                asignaciones={asignaciones}
                equipo={equipo}
                esCentro={esCentro}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function ScalesTab({ patientId }: { patientId: string }) {
  const [assignments, catalog] = await Promise.all([
    getScaleAssignments(patientId),
    getScaleCatalog(),
  ]);
  return (
    <ScalesPanel
      patientId={patientId}
      catalog={catalog}
      assignments={assignments}
    />
  );
}

const APPT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  scheduled: { label: "por confirmar", tone: "info" },
  confirmed: { label: "confirmada", tone: "accent" },
  cancelled: { label: "cancelada", tone: "neutral" },
  completed: { label: "completada", tone: "neutral" },
};

/** En una cita pasada lo que importa es si se acudió, no si estaba confirmada. */
const ASISTENCIA: Record<string, { label: string; tone: StatusTone }> = {
  attended: { label: "acudió", tone: "success" },
  no_show: { label: "no acudió", tone: "danger" },
  late_cancel: { label: "canceló tarde", tone: "warn" },
  pending: { label: "sin registrar", tone: "neutral" },
};

function FilaCita({ cita, pasada }: { cita: Appointment; pasada: boolean }) {
  const estado = pasada
    ? ASISTENCIA[cita.attendance] ?? {
        label: cita.attendance,
        tone: "neutral" as const,
      }
    : APPT_STATUS[cita.status] ?? {
        label: cita.status,
        tone: "neutral" as const,
      };
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 border-b border-line-soft py-3 last:border-b-0">
      <span className="text-[13.5px]">{formatDateTime(cita.starts_at)}</span>
      <div className="flex items-center gap-5">
        {pasada && cita.status === "cancelled" ? (
          <Status tone="neutral">cancelada</Status>
        ) : (
          <Status tone={estado.tone}>{estado.label}</Status>
        )}
        <a
          href={`/appointments/${cita.id}/ics`}
          className="text-[12.5px] text-accent hover:underline"
        >
          Descargar .ics
        </a>
      </div>
    </li>
  );
}

function AppointmentsTab({
  patientId,
  citas,
}: {
  patientId: string;
  citas: { proximas: Appointment[]; pasadas: Appointment[] };
}) {
  const { proximas, pasadas } = citas;
  // Dos columnas en escritorio: lo que viene y lo que ya pasó, como la agenda
  // y la semana en «Hoy».
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/pro/agenda?patient=${patientId}`}
        className="btn-primary self-start"
      >
        Nueva cita en la agenda
      </Link>

      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="min-w-0 flex-1">
          <h2 className="section-title mb-1">Próximas citas</h2>
          {proximas.length === 0 ? (
            <p className="py-3 text-[13.5px] text-ink-3">
              No tiene ninguna cita agendada. Créala desde la agenda.
            </p>
          ) : (
            <ul>
              {proximas.map((a) => (
                <FilaCita key={a.id} cita={a} pasada={false} />
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 flex-1">
          <h2 className="section-title mb-1">
            Historial de sesiones{" "}
            {pasadas.length > 0 && (
              <span className="font-normal text-ink-4">{pasadas.length}</span>
            )}
          </h2>
          {pasadas.length === 0 ? (
            <p className="py-3 text-[13.5px] text-ink-3">
              Todavía no ha acudido a ninguna sesión.
            </p>
          ) : (
            <ul>
              {pasadas.map((a) => (
                <FilaCita key={a.id} cita={a} pasada />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

async function PaymentsTab({ patientId }: { patientId: string }) {
  const detail = await getPatientPaymentDetail(patientId);
  return <PaymentsPanel patientId={patientId} detail={detail} />;
}

async function DiaryTab({ patientId }: { patientId: string }) {
  const entries = await getRecentMoodEntries(patientId);

  /*
   * El diario convive con DOS escalas: la original de cinco opciones y la de
   * cuatro caras que la sustituye (migración 20260919100001).
   *
   * Se dibuja **una serie por escala, nunca una sola**. Un 3 con la escala de
   * cinco era «Normal» y con la de cuatro es «Bien»: unirlos en la misma
   * gráfica inventaría una evolución que nadie ha medido, y aquí eso no es un
   * detalle estético — es la diferencia entre mostrar lo que dijo el paciente
   * y mostrar otra cosa. Por el mismo motivo no se calcula ninguna media.
   */
  const escalas = [...new Set(entries.map((e) => e.mood_scale))].sort(
    (a, b) =>
      (b === ESCALA_ACTUAL ? 1 : 0) - (a === ESCALA_ACTUAL ? 1 : 0) || b - a
  );

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">
          Este paciente todavía no ha registrado ningún estado de ánimo.
        </p>
      ) : (
        <div className="flex flex-col gap-8 xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            {escalas.map((escala) => {
              const deLaEscala = entries.filter((e) => e.mood_scale === escala);
              const points = [...deLaEscala]
                .reverse()
                .map((e) => ({
                  date: e.entry_date,
                  score: e.mood_value,
                  severity: null,
                }));
              return (
                <section key={escala}>
                  <h2 className="section-title">
                    Evolución del ánimo (1-{escala})
                  </h2>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    {escala === ESCALA_ACTUAL
                      ? `Del 1, «${etiquetaAnimo(
                          1,
                          escala
                        )}», al ${escala}, «${etiquetaAnimo(escala, escala)}».`
                      : `Escala anterior, retirada. Sus valores no son comparables con los de la escala de ${ESCALA_ACTUAL}.`}
                  </p>
                  <div className="mt-4">
                    <ScoreChart
                      points={points}
                      max={escala}
                      severity={[]}
                      title="Ánimo"
                    />
                  </div>
                </section>
              );
            })}
          </div>

          <section className="w-full border-t border-line pt-7 xl:w-[420px] xl:shrink-0 xl:border-t-0 xl:pt-0">
            <h2 className="section-title mb-1">Registros</h2>
            <ul>
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-4 border-b border-line-soft py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <span className="text-[13.5px] font-medium">
                      {etiquetaAnimo(e.mood_value, e.mood_scale)}
                    </span>
                    {/* El número va siempre con su escala: «3» a secas es ambiguo. */}
                    <span className="mono ml-2 text-[12.5px] text-ink-3">
                      {e.mood_value}/{e.mood_scale}
                    </span>
                    {e.note && (
                      <p className="mt-1 text-[13.5px] text-ink-2">{e.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[12.5px] text-ink-3">
                    {formatDate(e.entry_date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

async function ResourcesTab({ patientId }: { patientId: string }) {
  const resources = await getProfessionalResources(patientId);
  return <ResourcesPanel patientId={patientId} resources={resources} />;
}

async function DocumentsTab({ patientId }: { patientId: string }) {
  const docs = await getDocuments(patientId);
  return <DocumentsPanel patientId={patientId} documents={docs} />;
}
