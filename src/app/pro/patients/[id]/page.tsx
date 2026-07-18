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
      <Link href="/pro" className="text-sm text-neutral-500 hover:underline">
        ← Pacientes
      </Link>

      {alertCount > 0 && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          ⚠️ Este paciente tiene {alertCount} respuesta
          {alertCount > 1 ? "s" : ""} con el ítem de riesgo marcado.{" "}
          <Link
            href={`/pro/patients/${id}?tab=escalas`}
            className="font-medium underline"
          >
            Ver escalas
          </Link>
        </div>
      )}

      {/* Cabecera */}
      <div className="mt-2 flex flex-col gap-3 border-b border-black/[.08] pb-5 dark:border-white/[.12] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {patient.full_name ?? "Sin nombre"}
            </h1>
            {patient.status === "archived" && (
              <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                archivado
              </span>
            )}
          </div>
          {patient.email && (
            <p className="mt-0.5 text-sm text-neutral-500">{patient.email}</p>
          )}
          <div className="mt-2">
            <TagsEditor patientId={patient.id} tags={patient.tags} />
          </div>
        </div>
        <StatusButton patientId={patient.id} status={patient.status} />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {/* Pestañas */}
          <nav className="flex flex-wrap gap-1 border-b border-black/[.08] dark:border-white/[.12]">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/pro/patients/${id}?tab=${t.key}`}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5">
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
        className="mb-3 inline-flex rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Nueva cita en la agenda
      </Link>
      {appts.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin próximas citas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {appts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
            >
              <span className="text-sm">{formatDateTime(a.starts_at)}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">{a.status}</span>
                <a
                  href={`/appointments/${a.id}/ics`}
                  className="text-xs text-neutral-500 underline"
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
        <p className="text-sm text-neutral-500">Sin entradas en el diario.</p>
      ) : (
        <>
          <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
            <h3 className="mb-3 text-sm font-semibold">
              Evolución del ánimo (1-5)
            </h3>
            <ScoreChart points={points} max={5} severity={[]} title="Ánimo" />
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
              >
                <div>
                  <span className="font-medium">{e.mood_value}/5</span>
                  {e.note && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                      {e.note}
                    </p>
                  )}
                </div>
                <span className="text-xs text-neutral-400">
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
