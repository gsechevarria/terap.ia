import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { getMyAppointmentsSplit } from "@/lib/queries/appointments";
import {
  getMyRequests,
  getMyPendingByAppointment,
} from "@/lib/queries/appointment-requests";
import { formatDateTime, formatTime } from "@/lib/format";
import {
  agruparPorMes,
  diaDelMes,
  diaSemana,
  diaSemanaCorto,
  mesYAno,
} from "@/app/app/_ui/fechas";
import { PatientAppointmentItem } from "@/app/app/_components/PatientAppointmentItem";
import { AppointmentsTabs } from "@/app/app/_components/AppointmentsTabs";

export const metadata = { title: "Mis citas · Terap" };

/** Estado tal y como está en la base. Una cita pasada NO se da por realizada. */
const ESTADO: Record<string, string> = {
  scheduled: "Por confirmar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
};

export default async function PatientAppointmentsPage() {
  const [{ upcoming, past }, requests, byAppointment] = await Promise.all([
    getMyAppointmentsSplit(),
    getMyRequests(),
    getMyPendingByAppointment(),
  ]);

  // Las peticiones de cita nueva no cuelgan de ninguna cita: se listan aparte.
  const sueltas = requests.pending.filter((r) => !r.appointment_id);
  const meses = agruparPorMes(past, (a) => a.starts_at);

  const proximas = (
    <>
      {upcoming.length === 0 ? (
        <p className="tp-empty">
          No tienes citas próximas. Cuando quieras, pídele una a tu profesional
          con el botón de arriba.
        </p>
      ) : (
        upcoming.map((a) => {
          const solicitud = byAppointment.get(a.id) ?? null;
          return (
            <PatientAppointmentItem
              key={a.id}
              appt={a}
              canRespond
              request={solicitud}
              diaGrande={diaDelMes(a.starts_at)}
              diaSemana={diaSemana(a.starts_at)}
              hora={formatTime(a.starts_at)}
              mes={mesYAno(a.starts_at)}
              cambioPedidoA={
                solicitud?.preferred_start
                  ? formatDateTime(solicitud.preferred_start)
                  : null
              }
            />
          );
        })
      )}

      {sueltas.length > 0 && (
        <>
          <div className="tp-section-heading tp-space-top">
            <h2 className="tp-h2">
              {sueltas.length === 1 ? "Solicitud enviada" : "Solicitudes enviadas"}
            </h2>
          </div>
          {sueltas.map((r) => (
            <div className="tp-pending" key={r.id}>
              <span className="tp-pending-icon">
                <Clock size={20} strokeWidth={1.6} aria-hidden />
              </span>
              <div>
                <strong>
                  {r.preferred_start ? formatDateTime(r.preferred_start) : "Sin horario"}
                </strong>
                <p>Esperando respuesta</p>
              </div>
              <span className="tp-pending-state">Pendiente</span>
            </div>
          ))}
        </>
      )}

      <Link
        href="/app/appointments/new"
        className="tp-secondary tp-wide tp-request-another"
      >
        <Plus size={17} strokeWidth={2} aria-hidden />
        {upcoming.length === 0 && sueltas.length === 0
          ? "Pedir una cita"
          : "Pedir otra cita"}
      </Link>

      {requests.recent.length > 0 && (
        <>
          <div className="tp-section-heading tp-space-top">
            <h2 className="tp-h2">Respuestas recientes</h2>
          </div>
          {requests.recent.map((r) => (
            <div className="tp-pending" key={r.id}>
              <span className="tp-pending-icon">
                <Clock size={20} strokeWidth={1.6} aria-hidden />
              </span>
              <div>
                <strong>
                  {r.preferred_start
                    ? formatDateTime(r.preferred_start)
                    : "Anulación"}
                </strong>
                {r.resolution_note && <p>“{r.resolution_note}”</p>}
              </div>
              <span className="tp-pending-state">
                {r.status === "accepted"
                  ? "Aceptada"
                  : r.status === "declined"
                    ? "No disponible"
                    : "Retirada"}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );

  const anteriores =
    past.length === 0 ? (
      <p className="tp-empty">Aquí aparecerán tus citas pasadas.</p>
    ) : (
      <>
        {meses.map((grupo) => (
          <section key={grupo.titulo}>
            <h2 className="tp-history-month">{grupo.titulo}</h2>
            {grupo.filas.map((a) => (
              <div className="tp-history-row" key={a.id}>
                <span className="tp-mini-date">
                  <b>{diaDelMes(a.starts_at)}</b>
                  {diaSemanaCorto(a.starts_at)}
                </span>
                <span>
                  <strong>{formatTime(a.starts_at)}</strong>
                  <small>{ESTADO[a.status] ?? a.status}</small>
                </span>
              </div>
            ))}
          </section>
        ))}
      </>
    );

  return (
    <>
      <div className="tp-page-heading">
        <p className="tp-overline">Tu agenda personal</p>
        <div>
          <h1 className="tp-h1">Mis citas</h1>
          <Link
            href="/app/appointments/new"
            className="tp-round-action"
            aria-label="Pedir una cita"
          >
            <Plus size={21} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>

      <AppointmentsTabs
        proximasCount={upcoming.length}
        proximas={proximas}
        anteriores={anteriores}
      />
    </>
  );
}
