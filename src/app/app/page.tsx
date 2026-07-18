import Link from "next/link";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getUpcomingAppointments } from "@/lib/queries/patient-detail";
import { getMyActiveAssignments } from "@/lib/queries/scales";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PatientTasks } from "@/app/app/_components/PatientTasks";

export default async function PatientHome() {
  const patient = await getCurrentPatient();

  if (!patient) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Hola 👋</h1>
        <p className="mt-3 rounded-xl border border-dashed border-black/[.15] p-4 text-sm text-neutral-500 dark:border-white/[.15]">
          Todavía no estás vinculado a un profesional. Abre el enlace de
          invitación que te hayan enviado para darte de alta.
        </p>
      </div>
    );
  }

  const [tasks, appts, scales, pay] = await Promise.all([
    getTasksForPatient(patient.id),
    getUpcomingAppointments(patient.id),
    getMyActiveAssignments(),
    getMyPaymentSummary(),
  ]);
  const nextAppt = appts[0] ?? null;
  const firstName = patient.full_name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{firstName ? `, ${firstName}` : ""} 🌿
        </h1>
      </header>

      <section className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h2 className="text-sm font-semibold text-neutral-500">Próxima cita</h2>
        {nextAppt ? (
          <div className="mt-1 flex items-center justify-between">
            <span className="font-medium">{formatDateTime(nextAppt.starts_at)}</span>
            {nextAppt.video_link && (
              <Link
                href={nextAppt.video_link}
                className="text-sm text-sky-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Videollamada
              </Link>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">Sin citas próximas.</p>
        )}
        <Link
          href="/app/appointments"
          className="mt-3 inline-block text-sm text-sky-600 hover:underline"
        >
          Ver todas mis citas →
        </Link>
      </section>

      {(pay.debtCents > 0 || pay.packRemaining > 0) && (
        <Link
          href="/app/payments"
          className="flex items-center justify-between rounded-xl border border-black/[.08] p-4 transition-colors hover:bg-black/[.02] dark:border-white/[.12] dark:hover:bg-white/[.04]"
        >
          <span className="text-sm text-neutral-500">Pagos</span>
          <span className="text-sm">
            {pay.debtCents > 0 && (
              <span className="font-medium text-amber-600">
                {formatCurrency(pay.debtCents)} pendiente
              </span>
            )}
            {pay.debtCents > 0 && pay.packRemaining > 0 && " · "}
            {pay.packRemaining > 0 && (
              <span className="text-neutral-600 dark:text-neutral-300">
                bono: {pay.packRemaining}
              </span>
            )}
          </span>
        </Link>
      )}

      {scales.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Cuestionarios</h2>
          {scales.map((s) => (
            <Link
              key={s.id}
              href={`/app/scales/${s.id}`}
              className="flex items-center justify-between rounded-xl border border-black/[.08] p-4 transition-colors hover:bg-black/[.02] dark:border-white/[.12] dark:hover:bg-white/[.04]"
            >
              <div>
                <span className="font-medium">{s.code}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {s.assignmentType === "recurring" ? "recurrente" : "puntual"}
                </span>
              </div>
              <span className="text-sm text-sky-600">Responder →</span>
            </Link>
          ))}
        </section>
      )}

      <PatientTasks tasks={tasks} />
    </div>
  );
}
