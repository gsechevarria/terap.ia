import { getMyMoodToday } from "@/lib/queries/wellbeing";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Video } from "lucide-react";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getUpcomingAppointments } from "@/lib/queries/patient-detail";
import { getMyActiveAssignments } from "@/lib/queries/scales";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { getMyRequests } from "@/lib/queries/appointment-requests";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { addDaysYMD, formatYMD, parseYMD, todayYMD, ymdInTZ } from "@/lib/tz";
import { safeExternalUrl } from "@/lib/url";
import { Status } from "@/components/ui/Status";
import { PatientTasks } from "@/app/app/_components/PatientTasks";
import { MoodLogger } from "@/app/app/_components/MoodLogger";

/** "Hoy" / "Mañana" / la fecha. Todo resuelto en hora española, en servidor. */
function dayLabel(iso: string, today: string, tomorrow: string): string {
  const day = ymdInTZ(new Date(iso));
  if (day === today) return "Hoy";
  if (day === tomorrow) return "Mañana";
  return formatDate(iso);
}

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

  const [tasks, appts, scales, pay, mood, requests] = await Promise.all([
    getTasksForPatient(patient.id),
    getUpcomingAppointments(patient.id),
    getMyActiveAssignments(),
    getMyPaymentSummary(),
    getMyMoodToday(),
    getMyRequests(),
  ]);

  const nextAppt = appts[0] ?? null;
  const firstName = patient.full_name?.split(" ")[0] ?? "";
  const today = todayYMD();
  const tomorrow = formatYMD(addDaysYMD(parseYMD(today), 1));
  const video = safeExternalUrl(nextAppt?.video_link);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="page-title">Hola{firstName ? `, ${firstName}` : ""}</h1>
      </header>

      {/* Próxima cita: lo primero que quiere saber cualquiera al abrir esto. */}
      <section>
        <h2 className="section-label mb-2">Próxima cita</h2>
        {nextAppt ? (
          <div className="card p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">
                {dayLabel(nextAppt.starts_at, today, tomorrow)}
              </span>
              <span className="text-lg text-ink-2">
                {formatTime(nextAppt.starts_at)}
              </span>
              {nextAppt.status === "confirmed" ? (
                <span className="ml-auto">
                  <Status tone="accent">confirmada</Status>
                </span>
              ) : (
                <span className="ml-auto">
                  <Status tone="info">por confirmar</Status>
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {video && (
                <a
                  href={video}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-sm"
                >
                  <Video className="size-3.5" strokeWidth={2} aria-hidden />
                  Entrar a la videollamada
                </a>
              )}
              <Link href="/app/appointments" className="btn-subtle btn-sm">
                Ver mis citas
              </Link>
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-ink-2">
              No tienes ninguna cita programada.
            </p>
            <Link href="/app/appointments/new" className="btn-primary btn-sm">
              <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden />
              Pedir cita
            </Link>
          </div>
        )}

        {requests.pending.length > 0 && (
          <p className="mt-2 text-xs text-ink-3">
            Tienes {requests.pending.length} solicitud
            {requests.pending.length === 1 ? "" : "es"} esperando respuesta.
          </p>
        )}
      </section>

      <MoodLogger today={mood} />

      {scales.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-label">Cuestionarios</h2>
          {scales.map((s) => (
            <Link
              key={s.id}
              href={`/app/scales/${s.id}`}
              className="card row-hover flex items-center gap-3 p-4"
            >
              <div>
                <span className="text-sm font-medium">{s.code}</span>
                <span className="chip ml-2">
                  {s.assignmentType === "recurring" ? "recurrente" : "puntual"}
                </span>
              </div>
              <ChevronRight
                className="ml-auto size-4 text-ink-3"
                strokeWidth={2}
                aria-hidden
              />
            </Link>
          ))}
        </section>
      )}

      <PatientTasks tasks={tasks} today={today} />

      {(pay.debtCents > 0 || pay.packRemaining > 0) && (
        <Link
          href="/app/payments"
          className="card row-hover flex items-center gap-3 p-4"
        >
          <span className="section-label">Pagos</span>
          <span className="ml-auto text-sm">
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
          <ChevronRight className="size-4 text-ink-3" strokeWidth={2} aria-hidden />
        </Link>
      )}
    </div>
  );
}
