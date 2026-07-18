import Link from "next/link";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getUpcomingAppointments } from "@/lib/queries/patient-detail";
import { getMyActiveAssignments } from "@/lib/queries/scales";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PatientTasks } from "@/app/app/_components/PatientTasks";
import { MoodLogger } from "@/app/app/_components/MoodLogger";

export default async function PatientHome() {
  const patient = await getCurrentPatient();

  if (!patient) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="page-title">Hola</h1>
        <p className="mt-4 rounded-lg border border-dashed border-line p-5 text-sm text-ink-2">
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
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="page-title">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <MoodLogger />

      <section className="card p-4">
        <h2 className="section-label">Próxima cita</h2>
        {nextAppt ? (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {formatDateTime(nextAppt.starts_at)}
            </span>
            {nextAppt.video_link && (
              <Link
                href={nextAppt.video_link}
                className="text-sm font-medium text-accent hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Videollamada
              </Link>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-2">Sin citas próximas.</p>
        )}
        <Link
          href="/app/appointments"
          className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
        >
          Ver todas mis citas →
        </Link>
      </section>

      {(pay.debtCents > 0 || pay.packRemaining > 0) && (
        <Link
          href="/app/payments"
          className="card row-hover flex items-center justify-between p-4"
        >
          <span className="section-label">Pagos</span>
          <span className="text-sm">
            {pay.debtCents > 0 && (
              <span className="font-medium text-warn">
                {formatCurrency(pay.debtCents)} pendiente
              </span>
            )}
            {pay.debtCents > 0 && pay.packRemaining > 0 && " · "}
            {pay.packRemaining > 0 && (
              <span className="text-ink-2">bono: {pay.packRemaining}</span>
            )}
          </span>
        </Link>
      )}

      {scales.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Cuestionarios</h2>
          {scales.map((s) => (
            <Link
              key={s.id}
              href={`/app/scales/${s.id}`}
              className="card row-hover flex items-center justify-between p-4"
            >
              <div>
                <span className="text-sm font-medium">{s.code}</span>
                <span className="chip ml-2">
                  {s.assignmentType === "recurring" ? "recurrente" : "puntual"}
                </span>
              </div>
              <span className="text-sm font-medium text-accent">Responder →</span>
            </Link>
          ))}
        </section>
      )}

      <PatientTasks tasks={tasks} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/diary" className="card row-hover p-4 text-center text-sm font-medium">
          Mi diario
        </Link>
        <Link
          href="/app/resources"
          className="card row-hover p-4 text-center text-sm font-medium"
        >
          Recursos
        </Link>
      </div>
    </div>
  );
}
