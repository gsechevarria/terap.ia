import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPatient } from "@/lib/queries/patients";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getNotesForPatient } from "@/lib/queries/notes";
import { getActiveInvitation } from "@/lib/queries/invitations";
import {
  getDocuments,
  getPaymentsSummary,
  getRecentMoodEntries,
  getScaleAssignments,
  getUpcomingAppointments,
} from "@/lib/queries/patient-detail";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
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

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/pro" className="text-sm text-neutral-500 hover:underline">
        ← Pacientes
      </Link>

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

function FutureNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-black/[.15] p-3 text-xs text-neutral-500 dark:border-white/[.15]">
      {children}
    </p>
  );
}

async function ScalesTab({ patientId }: { patientId: string }) {
  const assignments = await getScaleAssignments(patientId);
  return (
    <div>
      {assignments.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Ninguna escala activada. Las escalas son opt-in: sin activación, el
          paciente no ve ninguna.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
            >
              <div>
                <span className="font-medium">{a.scaleCode}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {a.assignment_type === "recurring" ? "recurrente" : "puntual"}
                  {a.active ? "" : " · inactiva"}
                </span>
              </div>
              <div className="text-right text-sm">
                {a.latestScore != null ? (
                  <>
                    <span className="font-semibold">{a.latestScore}</span>{" "}
                    <span className="text-neutral-500">{a.latestSeverity}</span>
                    <div className="text-xs text-neutral-400">
                      {formatDate(a.latestAt)}
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-neutral-400">Sin respuestas</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FutureNote>La activación de escalas se gestiona en la Sesión 4.</FutureNote>
    </div>
  );
}

async function AppointmentsTab({ patientId }: { patientId: string }) {
  const appts = await getUpcomingAppointments(patientId);
  return (
    <div>
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
              <span className="text-xs text-neutral-500">{a.status}</span>
            </li>
          ))}
        </ul>
      )}
      <FutureNote>La agenda completa se gestiona en la Sesión 5.</FutureNote>
    </div>
  );
}

async function PaymentsTab({ patientId }: { patientId: string }) {
  const { payments, debtCents, packRemaining } =
    await getPaymentsSummary(patientId);
  return (
    <div>
      <div className="flex gap-4">
        <div className="rounded-lg border border-black/[.08] px-4 py-2 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Deuda pendiente</div>
          <div className="font-semibold">{formatCurrency(debtCents)}</div>
        </div>
        <div className="rounded-lg border border-black/[.08] px-4 py-2 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Sesiones de bono</div>
          <div className="font-semibold">{packRemaining}</div>
        </div>
      </div>
      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Sin pagos registrados.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
            >
              <span className="text-sm">{formatCurrency(p.amount_cents, p.currency)}</span>
              <span
                className={`text-xs font-medium ${
                  p.status === "paid" ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {p.status === "paid" ? "pagado" : "pendiente"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <FutureNote>
        El seguimiento de pagos (sin facturación) se gestiona en la Sesión 6.
      </FutureNote>
    </div>
  );
}

async function DiaryTab({ patientId }: { patientId: string }) {
  const entries = await getRecentMoodEntries(patientId);
  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin entradas en el diario.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
            >
              <div>
                <span className="font-medium">{"● ".repeat(e.mood_value)}</span>
                <span className="text-xs text-neutral-500">{e.mood_value}/5</span>
                {e.note && (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    {e.note}
                  </p>
                )}
              </div>
              <span className="text-xs text-neutral-400">{formatDate(e.entry_date)}</span>
            </li>
          ))}
        </ul>
      )}
      <FutureNote>
        El diario emocional (solo registro, sin interpretación) se gestiona en la
        Sesión 7.
      </FutureNote>
    </div>
  );
}

async function DocumentsTab({ patientId }: { patientId: string }) {
  const docs = await getDocuments(patientId);
  return (
    <div>
      {docs.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin documentos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.12]"
            >
              {d.title ?? d.storage_path}
            </li>
          ))}
        </ul>
      )}
      <FutureNote>El repositorio de documentos se gestiona en la Sesión 7.</FutureNote>
    </div>
  );
}
