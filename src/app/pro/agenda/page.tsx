import {
  getPatientsForSelect,
  getProfessionalAgenda,
  type AgendaAppointment,
} from "@/lib/queries/appointments";
import { NewAppointment } from "@/app/pro/_components/NewAppointment";
import { NewBlock } from "@/app/pro/_components/NewBlock";
import { AppointmentItem } from "@/app/pro/_components/AppointmentItem";
import { BlockItem } from "@/app/pro/_components/BlockItem";

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;
  const [{ appointments, blocks }, patients] = await Promise.all([
    getProfessionalAgenda(),
    getPatientsForSelect(),
  ]);

  const byDay = new Map<string, AgendaAppointment[]>();
  for (const a of appointments) {
    const k = dayKey(a.starts_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(a);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">Agenda</h1>
      <p className="mt-1 text-sm text-ink-2">
        Próximas citas y disponibilidad desde hoy.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <NewAppointment patients={patients} defaultPatientId={patient} />
        <NewBlock />
      </div>

      <div className="mt-10">
        {appointments.length === 0 ? (
          <p className="text-sm text-ink-2">No hay citas próximas.</p>
        ) : (
          [...byDay.entries()].map(([day, appts]) => (
            <div key={day} className="mb-8">
              <h2 className="section-label mb-2 capitalize">{day}</h2>
              <ul className="card divide-y divide-line">
                {appts.map((a) => (
                  <AppointmentItem key={a.id} appt={a} />
                ))}
              </ul>
            </div>
          ))
        )}

        {blocks.length > 0 && (
          <div className="mt-4">
            <h2 className="section-label mb-2">Bloqueos</h2>
            <ul className="card divide-y divide-line">
              {blocks.map((b) => (
                <BlockItem key={b.id} block={b} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
