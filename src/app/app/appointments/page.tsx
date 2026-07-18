import Link from "next/link";
import { getMyAppointmentsSplit } from "@/lib/queries/appointments";
import { PatientAppointmentItem } from "@/app/app/_components/PatientAppointmentItem";

export default async function PatientAppointmentsPage() {
  const { upcoming, past } = await getMyAppointmentsSplit();

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="text-sm text-ink-3 hover:text-ink">
        ← Inicio
      </Link>
      <h1 className="page-title mt-3">Mis citas</h1>

      <section className="mt-6">
        <h2 className="section-label mb-2">Próximas</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-2">No tienes citas próximas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <PatientAppointmentItem key={a.id} appt={a} canRespond />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="section-label mb-2">Anteriores</h2>
          <ul className="flex flex-col gap-2">
            {past.map((a) => (
              <PatientAppointmentItem key={a.id} appt={a} canRespond={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
