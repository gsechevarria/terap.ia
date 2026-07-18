import Link from "next/link";
import { getMyAppointmentsSplit } from "@/lib/queries/appointments";
import { PatientAppointmentItem } from "@/app/app/_components/PatientAppointmentItem";

export default async function PatientAppointmentsPage() {
  const { upcoming, past } = await getMyAppointmentsSplit();

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mis citas</h1>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Próximas</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">No tienes citas próximas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <PatientAppointmentItem key={a.id} appt={a} canRespond />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-neutral-500">Anteriores</h2>
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
