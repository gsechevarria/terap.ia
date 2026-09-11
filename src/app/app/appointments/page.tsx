import Link from "next/link";
import { Plus } from "lucide-react";
import { getMyAppointmentsSplit } from "@/lib/queries/appointments";
import {
  getMyRequests,
  getMyPendingByAppointment,
} from "@/lib/queries/appointment-requests";
import { formatDateTime } from "@/lib/format";
import { Status } from "@/components/ui/Status";
import { PatientAppointmentItem } from "@/app/app/_components/PatientAppointmentItem";

export default async function PatientAppointmentsPage() {
  const [{ upcoming, past }, requests, byAppointment] = await Promise.all([
    getMyAppointmentsSplit(),
    getMyRequests(),
    getMyPendingByAppointment(),
  ]);

  // Las peticiones de cita nueva no cuelgan de ninguna cita: se listan aparte.
  const standalone = requests.pending.filter((r) => !r.appointment_id);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Mis citas</h1>

      <Link href="/app/appointments/new" className="btn-primary btn-lg mt-4 w-full">
        <Plus className="size-4" strokeWidth={2.5} aria-hidden />
        Pedir cita
      </Link>

      {standalone.length > 0 && (
        <section className="mt-6">
          <h2 className="section-label mb-2">Solicitudes enviadas</h2>
          <ul className="flex flex-col gap-2">
            {standalone.map((r) => (
              <li key={r.id} className="card flex items-center gap-3 p-4">
                <span className="text-sm">
                  {r.preferred_start ? formatDateTime(r.preferred_start) : "—"}
                </span>
                <span className="ml-auto">
                  <Status tone="info">esperando respuesta</Status>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="section-label mb-2">Próximas</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-2">No tienes citas próximas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <PatientAppointmentItem
                key={a.id}
                appt={a}
                canRespond
                request={byAppointment.get(a.id) ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      {requests.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="section-label mb-2">Respuestas recientes</h2>
          <ul className="card divide-y divide-line">
            {requests.recent.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span>
                    {r.preferred_start ? formatDateTime(r.preferred_start) : "Anulación"}
                  </span>
                  <span className="ml-auto">
                    {r.status === "accepted" ? (
                      <Status tone="success">aceptada</Status>
                    ) : r.status === "declined" ? (
                      <Status tone="warn">no disponible</Status>
                    ) : (
                      <Status tone="neutral">retirada</Status>
                    )}
                  </span>
                </div>
                {r.resolution_note && (
                  <p className="mt-1 text-ink-2">“{r.resolution_note}”</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
