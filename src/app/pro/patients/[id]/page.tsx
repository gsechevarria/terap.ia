import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPatient } from "@/lib/queries/patients";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getNotesForPatient } from "@/lib/queries/notes";
import { getActiveInvitation } from "@/lib/queries/invitations";
import {
  getDocuments,
  getRecentMoodEntries,
  getScaleAssignments,
  getUpcomingAppointments,
} from "@/lib/queries/patient-detail";
import { getScaleCatalog, getFlaggedCountForPatient } from "@/lib/queries/scales";
import { getPatientPaymentDetail } from "@/lib/queries/payments";
import { getProfessionalResources } from "@/lib/queries/wellbeing";
import { ScalesPanel } from "@/app/pro/_components/ScalesPanel";
import { PaymentsPanel } from "@/app/pro/_components/PaymentsPanel";
import { ResourcesPanel } from "@/app/pro/_components/ResourcesPanel";
import { DocumentsPanel } from "@/app/pro/_components/DocumentsPanel";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import { formatDate, formatDateTime } from "@/lib/format";
import { StatusButton } from "@/app/pro/_components/StatusButton";
import { TagsEditor } from "@/app/pro/_components/TagsEditor";
import { InvitePanel } from "@/app/pro/_components/InvitePanel";
import { TasksPanel } from "@/app/pro/_components/TasksPanel";
import { NotesPanel } from "@/app/pro/_components/NotesPanel";

const TABS = [
  { key: "tareas", label: "Tareas" },
  { key: "notas", label: "Notas" },
  { key: "escalas", label: "Escalas" },
  { key: "citas", label: "Citas" },
  { key: "pagos", label: "Pagos" },
  { key: "diario", label: "Diario" },
  { key: "recursos", label: "Recursos" },
  { key: "documentos", label: "Documentos" },
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
  const tab = (TABS.find((t) => t.key === tabRaw)?.key ?? "tareas") as TabKey;

  const patient = await getPatient(id);
  if (!patient) notFound();

  const invitation = await getActiveInvitation(id);
  const alertCount = await getFlaggedCountForPatient(id);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/pro" className="text-sm text-ink-3 hover:text-ink">
        ← Pacientes
      </Link>

      {alertCount > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded border border-danger/25 bg-danger-soft p-3 text-sm text-danger">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-danger" />
          <p>
            Este paciente tiene {alertCount} respuesta
            {alertCount > 1 ? "s" : ""} con el ítem de riesgo marcado.{" "}
            <Link
              href={`/pro/patients/${id}?tab=escalas`}
              className="font-medium underline underline-offset-2"
            >
              Ver escalas
            </Link>
          </p>
        </div>
      )}

      {/* Cabecera */}
      <div className="mt-3 flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-panel text-lg font-semibold text-ink-2">
            {(patient.full_name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="page-title truncate">
                {patient.full_name ?? "Sin nombre"}
              </h1>
              {patient.status === "archived" && (
                <span className="chip">archivado</span>
              )}
            </div>
            {patient.email && (
              <p className="mt-0.5 text-sm text-ink-2">{patient.email}</p>
            )}
            <div className="mt-2">
              <TagsEditor patientId={patient.id} tags={patient.tags} />
            </div>
          </div>
        </div>
        <StatusButton patientId={patient.id} status={patient.status} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {/* Pestañas */}
          <nav className="flex flex-wrap gap-0.5 border-b border-line">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/pro/patients/${id}?tab=${t.key}`}
                className={`-mb-px border-b-2 px-2.5 py-1.5 text-sm transition-colors duration-100 ${
                  tab === t.key
                    ? "border-ink font-medium text-ink"
                    : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6">
            {tab === "tareas" && (
              <TasksPanel patientId={id} tasks={await getTasksForPatient(id)} />
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
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <InvitePanel
            patientId={id}
            baseUrl={baseUrl}
            initialToken={invitation?.token}
            initialExpiresAt={invitation?.expires_at}
          />
        </aside>
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

async function AppointmentsTab({ patientId }: { patientId: string }) {
  const appts = await getUpcomingAppointments(patientId);
  return (
    <div>
      <Link
        href={`/pro/agenda?patient=${patientId}`}
        className="btn-primary mb-4"
      >
        Nueva cita en la agenda
      </Link>
      {appts.length === 0 ? (
        <p className="text-sm text-ink-2">Sin próximas citas.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {appts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm">{formatDateTime(a.starts_at)}</span>
              <div className="flex items-center gap-3">
                <span className="chip">{a.status}</span>
                <a
                  href={`/appointments/${a.id}/ics`}
                  className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
                >
                  .ics
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
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
