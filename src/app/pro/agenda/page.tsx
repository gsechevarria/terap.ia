import Link from "next/link";
import {
  getPatientsForSelect,
  getProfessionalAgendaRange,
} from "@/lib/queries/appointments";
import { resolveAgendaWindow } from "@/lib/agenda-window";
import {
  AgendaCalendar,
  type CalendarView,
} from "@/app/pro/_components/AgendaCalendar";
import { NewAppointment } from "@/app/pro/_components/NewAppointment";
import { NewBlock } from "@/app/pro/_components/NewBlock";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; view?: string; date?: string }>;
}) {
  const { patient, view: viewRaw, date: dateRaw } = await searchParams;
  const w = resolveAgendaWindow(viewRaw, dateRaw);

  const [{ appointments, blocks }, patients] = await Promise.all([
    getProfessionalAgendaRange(w.fromISO, w.toISO),
    getPatientsForSelect(),
  ]);

  const href = (view: CalendarView, dateYMD: string) => {
    const p = new URLSearchParams();
    if (view !== "week") p.set("view", view);
    p.set("date", dateYMD);
    if (patient) p.set("patient", patient);
    return `/pro/agenda?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="page-title">Agenda</h1>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1fr_19rem]">
        {/* Izquierda: toolbar + calendario */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Link
                href={href(w.view, w.prevYMD)}
                aria-label="Anterior"
                className="btn-ghost h-7 w-7 px-0"
              >
                ‹
              </Link>
              <Link
                href={href(w.view, w.todayYMD)}
                className="btn-ghost h-7 px-2.5 text-xs"
              >
                Hoy
              </Link>
              <Link
                href={href(w.view, w.nextYMD)}
                aria-label="Siguiente"
                className="btn-ghost h-7 w-7 px-0"
              >
                ›
              </Link>
              <span className="ml-2 text-sm font-semibold capitalize">
                {w.label}
              </span>
            </div>
            <div className="flex rounded bg-panel p-0.5">
              {VIEWS.map((v) => (
                <Link
                  key={v.key}
                  href={href(v.key, w.dateYMD)}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors duration-100 ${
                    w.view === v.key
                      ? "bg-canvas text-ink shadow-[0_1px_2px_rgba(15,15,15,0.08)]"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {v.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <AgendaCalendar
              view={w.view}
              dateYMD={w.dateYMD}
              appointments={appointments}
              blocks={blocks}
            />
          </div>
        </div>

        {/* Derecha: nueva cita + acceso al listado completo */}
        <aside className="flex flex-col gap-3">
          <NewAppointment patients={patients} defaultPatientId={patient} />
          <Link href="/pro/agenda/citas" className="btn-ghost w-full">
            Ver todas las citas
          </Link>
          <details className="card bg-panel">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase transition-colors hover:text-ink">
              Nuevo bloqueo (vacaciones / no disponible)
            </summary>
            <div className="px-4 pb-4">
              <NewBlock />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
