import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteUrl } from "@/lib/site-url";
import { addDaysYMD, formatYMD, parseYMD, todayYMD } from "@/lib/tz";
import { notFound } from "next/navigation";
import { getPatient } from "@/lib/queries/patients";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getNotesForPatient } from "@/lib/queries/notes";
import { getActiveInvitation } from "@/lib/queries/invitations";
import {
  getDocuments,
  getRecentMoodEntries,
  getScaleAssignments,
  getPatientAppointments,
} from "@/lib/queries/patient-detail";
import type { Appointment } from "@/lib/types";
import { getScaleCatalog, getUnacknowledgedFlagged } from "@/lib/queries/scales";
import { getPatientPaymentDetail } from "@/lib/queries/payments";
import { getProfessionalResources } from "@/lib/queries/wellbeing";
import { ScalesPanel } from "@/app/pro/_components/ScalesPanel";
import { PaymentsPanel } from "@/app/pro/_components/PaymentsPanel";
import { ResourcesPanel } from "@/app/pro/_components/ResourcesPanel";
import { DocumentsPanel } from "@/app/pro/_components/DocumentsPanel";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import { ageFromBirthDate, formatDate, formatDateTime } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";
import { StatusButton } from "@/app/pro/_components/StatusButton";
import { TagsEditor } from "@/app/pro/_components/TagsEditor";
import { InvitePanel } from "@/app/pro/_components/InvitePanel";
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
  { key: "invitacion", label: "Invitación" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = (TABS.find((t) => t.key === tabRaw)?.key ?? "informacion") as TabKey;

  const patient = await getPatient(id);
  if (!patient) notFound();

  // Independientes entre sí: en secuencia eran tres viajes encadenados.
  const [invitation, flagged] = await Promise.all([
    getActiveInvitation(id),
    getUnacknowledgedFlagged(id),
  ]);

  // El enlace de invitación lleva el token en el path, así que su base NO puede
  // salir de cabeceras: con un proxy mal configurado, o una petición directa al
  // origen, un `x-forwarded-host: evil.tld` generaba un enlace que entregaba el
  // token al atacante. Se toma de la configuración del despliegue.
  const baseUrl = siteUrl();
  // "Hoy" en la zona del profesional, resuelto una vez en el servidor.
  const hoy = todayYMD();

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-label-sm text-ink-3">
        <Link href="/pro" className="transition-colors hover:text-accent">
          Pacientes
        </Link>
        <ChevronRight size={13} strokeWidth={1.75} aria-hidden className="text-ink-faint" />
        <span className="truncate font-medium text-ink">
          {patient.full_name ?? "Sin nombre"}
        </span>
      </nav>

      <FlaggedAlerts patientId={id} responses={flagged} />

      {/* Cabecera del expediente, como isla: el dato de identidad se separa del
          contenido por superficie y no por una línea más. */}
      <header className="card mt-4 flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-accent-soft text-headline font-semibold text-accent"
          >
            {(patient.full_name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="page-title truncate">
                {patient.full_name ?? "Sin nombre"}
              </h1>
              <Status tone={patient.status === "archived" ? "neutral" : "success"}>
                {patient.status === "archived" ? "Archivado" : "En seguimiento"}
              </Status>
            </div>
            {patient.email && (
              <p className="mt-1 text-sm text-ink-2">{patient.email}</p>
            )}
            <div className="mt-3">
              <TagsEditor patientId={patient.id} tags={patient.tags} />
            </div>
          </div>
        </div>
        <StatusButton patientId={patient.id} status={patient.status} />
      </header>

      <div className="mt-6">
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

          <div className="mt-6">
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
                tasks={await getTasksForPatient(id)}
                today={hoy}
                soon={formatYMD(addDaysYMD(parseYMD(hoy), 2))}
              />
            )}
            {tab === "notas" && (
              <NotesPanel patientId={id} notes={await getNotesForPatient(id)} />
            )}
            {tab === "escalas" && <ScalesTab patientId={id} />}
            {tab === "citas" && <AppointmentsTab patientId={id} />}
            {tab === "pagos" && <PaymentsTab patientId={id} />}
            {tab === "diario" && <DiaryTab patientId={id} />}
            {tab === "recursos" && <ResourcesTab patientId={id} />}
            {tab === "documentos" && <DocumentsTab patientId={id} />}
            {tab === "invitacion" && (
              <div className="max-w-xl">
                <InvitePanel
                  patientId={id}
                  baseUrl={baseUrl}
                  activeExpiresAt={invitation?.expires_at}
                />
              </div>
            )}
          </div>
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
    ? (ASISTENCIA[cita.attendance] ?? { label: cita.attendance, tone: "neutral" as const })
    : (APPT_STATUS[cita.status] ?? { label: cita.status, tone: "neutral" as const });
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="text-[13px]">{formatDateTime(cita.starts_at)}</span>
      <div className="flex items-center gap-3">
        {pasada && cita.status === "cancelled" ? (
          <Status tone="neutral">cancelada</Status>
        ) : (
          <Status tone={estado.tone}>{estado.label}</Status>
        )}
        <a
          href={`/appointments/${cita.id}/ics`}
          className="text-[11px] text-ink-3 underline underline-offset-2 hover:text-ink"
        >
          .ics
        </a>
      </div>
    </li>
  );
}

async function AppointmentsTab({ patientId }: { patientId: string }) {
  const { proximas, pasadas } = await getPatientAppointments(patientId);
  return (
    <div className="flex flex-col gap-7">
      <Link href={`/pro/agenda?patient=${patientId}`} className="btn-primary self-start">
        Nueva cita en la agenda
      </Link>

      <section>
        <h3 className="section-label mb-2.5">Próximas citas</h3>
        {proximas.length === 0 ? (
          <p className="text-[13px] text-ink-2">Sin próximas citas.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {proximas.map((a) => (
              <FilaCita key={a.id} cita={a} pasada={false} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="section-label mb-2.5">
          Historial de sesiones
          {pasadas.length > 0 && (
            <span className="mono ml-2 font-normal normal-case">
              {pasadas.length}
            </span>
          )}
        </h3>
        {pasadas.length === 0 ? (
          <p className="text-[13px] text-ink-2">Todavía no hay citas pasadas.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {pasadas.map((a) => (
              <FilaCita key={a.id} cita={a} pasada />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function PaymentsTab({ patientId }: { patientId: string }) {
  const detail = await getPatientPaymentDetail(patientId);
  return <PaymentsPanel patientId={patientId} detail={detail} />;
}

async function DiaryTab({ patientId }: { patientId: string }) {
  const entries = await getRecentMoodEntries(patientId);
  const points = [...entries]
    .reverse()
    .map((e) => ({ date: e.entry_date, score: e.mood_value, severity: null }));
  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-2">Sin entradas en el diario.</p>
      ) : (
        <>
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">
              Evolución del ánimo (1-5)
            </h3>
            <ScoreChart points={points} max={5} severity={[]} title="Ánimo" />
          </div>
          <ul className="card mt-4 divide-y divide-line">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">{e.mood_value}/5</span>
                  {e.note && (
                    <p className="mt-1 text-sm text-ink-2">{e.note}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-3">
                  {formatDate(e.entry_date)}
                </span>
              </li>
            ))}
          </ul>
        </>
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
