import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

      {/* La columna derecha se aparta hasta `xl`: con `max-w-6xl` (1152 px) y
          19rem de aside, al calendario le quedaban ~824 px, por debajo de lo que
          necesitan siete días. La semana se cortaba a CUALQUIER anchura de
          ventana, porque el tope no depende de la pantalla. */}
      <div className="mt-6 grid items-start gap-7 xl:grid-cols-[1fr_19rem]">
        {/* Izquierda: toolbar + calendario */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Link
                href={href(w.view, w.prevYMD)}
                aria-label="Anterior"
                className="btn-ghost size-8 rounded-xl px-0"
              >
                <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
              <Link
                href={href(w.view, w.todayYMD)}
                className="btn-ghost btn-sm rounded-xl"
              >
                Hoy
              </Link>
              <Link
                href={href(w.view, w.nextYMD)}
                aria-label="Siguiente"
                className="btn-ghost size-8 rounded-xl px-0"
              >
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
              <span className="ml-2 text-[15px] font-semibold capitalize">
                {w.label}
              </span>
            </div>
            <div className="segmented" role="group" aria-label="Vista del calendario">
              {VIEWS.map((v) => (
                <Link
                  key={v.key}
                  href={href(v.key, w.dateYMD)}
                  aria-current={w.view === v.key ? "page" : undefined}
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
              patients={patients}
              defaultPatientId={patient}
            />
          </div>
        </div>

        {/* Derecha: nueva cita + acceso al listado completo. El bloqueo va
            plegado y separado por una línea, no en otra tarjeta: tres cajas
            apiladas dicen que las tres cosas pesan lo mismo, y no es el caso. */}
        <aside className="flex flex-col gap-4">
          <NewAppointment
            patients={patients}
            defaultPatientId={patient}
            initialDay={w.todayYMD}
          />
          <Link href="/pro/agenda/citas" className="btn-ghost w-full">
            Ver todas las citas
          </Link>
          <details className="border-t border-line pt-4">
            <summary className="cursor-pointer list-none text-[13.5px] font-medium text-ink-2 transition-colors hover:text-ink">
              Bloquear una franja para vacaciones o ausencias
            </summary>
            <div className="mt-3">
              <NewBlock />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
