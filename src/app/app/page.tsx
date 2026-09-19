import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Video,
} from "lucide-react";
import { getMyMoodToday } from "@/lib/queries/wellbeing";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getTasksForPatient } from "@/lib/queries/tasks";
import { getUpcomingAppointments } from "@/lib/queries/patient-detail";
import { getMyActiveAssignments } from "@/lib/queries/scales";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { getMyRequests } from "@/lib/queries/appointment-requests";
import { formatCurrency, formatTime } from "@/lib/format";
import { addDaysYMD, formatYMD, parseYMD, todayYMD } from "@/lib/tz";
import { safeExternalUrl } from "@/lib/url";
import {
  diaDelMes,
  etiquetaDia,
  fechaLargaYMD,
  mesLargo,
} from "@/app/app/_ui/fechas";
import { PatientTasks } from "@/app/app/_components/PatientTasks";
import { MoodEntryForm } from "@/app/app/_components/MoodEntryForm";

export default async function PatientHome() {
  const patient = await getCurrentPatient();

  if (!patient) {
    return (
      <>
        <div className="tp-page-heading">
          <p className="tp-overline">Tu espacio</p>
          <div>
            <h1 className="tp-h1">Hola</h1>
          </div>
        </div>
        <p className="tp-empty">
          Todavía no estás vinculado a un profesional. Abre el enlace de
          invitación que te hayan enviado para darte de alta.
        </p>
      </>
    );
  }

  const [tasks, appts, escalas, pay, mood, requests] = await Promise.all([
    getTasksForPatient(patient.id),
    getUpcomingAppointments(patient.id),
    // Opt-in estricto: solo las que el profesional ha activado Y tocan ahora.
    // Sin activación no llega nada, que es el comportamiento acordado.
    getMyActiveAssignments(),
    getMyPaymentSummary(),
    getMyMoodToday(),
    getMyRequests(),
  ]);

  const proxima = appts[0] ?? null;
  const nombre = patient.full_name?.split(" ")[0] ?? "";
  const inicial = (nombre || patient.full_name || "?").charAt(0).toUpperCase();
  const hoy = todayYMD();
  const manana = formatYMD(addDaysYMD(parseYMD(hoy), 1));
  const video = safeExternalUrl(proxima?.video_link);
  const enEspera = requests.pending.length;

  return (
    <>
      <div className="tp-greeting">
        <div>
          <p className="tp-overline">{fechaLargaYMD(hoy)}</p>
          <h1 className="tp-h1">Hola{nombre ? `, ${nombre}` : ""}</h1>
        </div>
        {/* No hay pantalla de perfil: el destino real más cercano es "Más",
            que es donde viven cuenta, pagos y ayuda urgente. */}
        <Link href="/app/more" className="tp-profile" aria-label="Más opciones">
          <span aria-hidden>{inicial}</span>
        </Link>
      </div>

      {/* Próxima sesión. Fecha y hora antes que nada: es lo que se viene a
          mirar al abrir la aplicación. */}
      {proxima ? (
        <article className="tp-session">
          <div className="tp-session-header">
            <span className="tp-session-label">Próxima sesión</span>
            <span className="tp-status-inverse">
              {proxima.status === "confirmed" ? "Confirmada" : "Por confirmar"}
            </span>
          </div>
          <div className="tp-session-main">
            <div className="tp-date-block">
              <strong>{diaDelMes(proxima.starts_at)}</strong>
              <span>{mesLargo(proxima.starts_at)}</span>
            </div>
            <div className="tp-session-info">
              <h2>
                {etiquetaDia(proxima.starts_at, hoy, manana)},{" "}
                {formatTime(proxima.starts_at)}
              </h2>
              <p>Con tu profesional</p>
              {video && <span>Tienes enlace de videollamada.</span>}
            </div>
          </div>
          {video ? (
            <a
              className="tp-session-cta"
              href={video}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Entrar a la videollamada</span>
              <Video size={20} strokeWidth={1.7} aria-hidden />
            </a>
          ) : (
            <Link className="tp-session-cta" href="/app/appointments">
              <span>Revisar mi cita</span>
              <ArrowRight size={20} strokeWidth={1.7} aria-hidden />
            </Link>
          )}
        </article>
      ) : (
        <div className="tp-session-empty">
          <p>
            No tienes ninguna cita programada. Puedes pedirle una a tu
            profesional cuando te venga bien.
          </p>
          <Link href="/app/appointments/new" className="tp-primary tp-wide">
            <CalendarPlus size={19} strokeWidth={1.8} aria-hidden />
            Pedir cita
          </Link>
        </div>
      )}

      {enEspera > 0 && (
        <Link href="/app/appointments" className="tp-request-notice">
          <Clock size={16} strokeWidth={1.7} aria-hidden />
          <span>
            {enEspera === 1
              ? "Tienes una solicitud en espera"
              : `Tienes ${enEspera} solicitudes en espera`}
          </span>
          <ChevronRight size={15} strokeWidth={1.8} aria-hidden />
        </Link>
      )}

      {/* El mismo formulario que el diario: cuatro caras, nota opcional y un
          botón. Antes aquí se guardaba al tocar una cara, sin nota; tener dos
          caminos hacia la misma fila era tener dos sitios donde equivocarse. */}
      {/* El encabezado lo pone el propio formulario; la sección solo aporta
          la separación. Repetirlo aquí daría dos títulos para una cosa. */}
      <section className="tp-mood-section">
        <MoodEntryForm hoy={mood} dia={hoy} enlaceAlDiario />
      </section>

      <PatientTasks tasks={tasks} hoy={hoy} />

      {/* Cuestionarios. Se enuncian como una petición del profesional: el
          paciente no ve puntuación ni severidad, ni aquí ni al responder. */}
      {escalas.length > 0 && (
        <section className="tp-question-section" aria-labelledby="tp-cuestionarios">
          <div className="tp-section-heading">
            <h2 className="tp-h2" id="tp-cuestionarios">
              Antes de tu sesión
            </h2>
            <span>
              {escalas.length} {escalas.length === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>
          <p className="tp-section-desc">
            Cuestionarios que te ha pedido tu profesional.
          </p>
          <div className="tp-question-grid">
            {escalas.map((e) => (
              <Link key={e.id} href={`/app/scales/${e.id}`}>
                <FileText size={22} strokeWidth={1.6} aria-hidden />
                <strong>{e.code}</strong>
                <span className="tp-q-name">{e.name}</span>
                <span className="tp-q-go">
                  Responder
                  <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* La entrega no dibuja los pagos en el inicio, pero esconder una deuda
          viva detrás de dos toques sería una regresión funcional, así que se
          conserva como fila discreta y solo cuando hay algo que decir. */}
      {(pay.debtCents > 0 || pay.packRemaining > 0) && (
        <div className="tp-card tp-space-top">
          <Link href="/app/payments" className="tp-list-row">
            <CreditCard size={18} strokeWidth={1.7} aria-hidden />
            <span className="tp-list-label">Pagos</span>
            <span className="tp-list-hint">
              {pay.debtCents > 0 && `${formatCurrency(pay.debtCents)} pendiente`}
              {pay.debtCents > 0 && pay.packRemaining > 0 && " · "}
              {pay.packRemaining > 0 && `bono: ${pay.packRemaining}`}
            </span>
            <ChevronRight
              size={17}
              strokeWidth={1.8}
              aria-hidden
              className="tp-chevron"
            />
          </Link>
        </div>
      )}

      <p className="tp-end-note">Tu espacio entre sesiones.</p>
    </>
  );
}
