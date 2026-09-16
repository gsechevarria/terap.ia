"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { requestAppointmentAction } from "@/lib/actions/appointments";
import { fromDatetimeLocal, formatDateTime } from "@/lib/format";
import { DateField } from "@/components/ui/DateField";

/** Franjas habituales de consulta. Son propuestas: decide el profesional. */
const HORAS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "16:00", "16:30", "17:00",
  "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
];

export function RequestAppointmentForm({
  mode,
  appointmentId,
  currentStart,
  defaultDay,
}: {
  mode: "new" | "reschedule";
  appointmentId?: string;
  /** Horario de la cita que se quiere mover, para recordarlo al paciente. */
  currentStart?: string | null;
  /** 'YYYY-MM-DD' de mañana, resuelto en servidor para no romper la hidratación. */
  defaultDay: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useAction({ refresh: false });
  const [hora, setHora] = useState("");
  const [enviado, setEnviado] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dia = String(form.get("day") ?? "");
    const nota = String(form.get("note") ?? "");
    const cuando = fromDatetimeLocal(`${dia}T${hora}`);
    if (!cuando) return;

    run(
      () =>
        callAction(requestAppointmentAction, {
          kind: mode,
          preferredStart: cuando.toISOString(),
          note: nota,
          appointmentId,
        }).then(() => undefined),
      () => {
        setEnviado(true);
        router.refresh();
      },
    );
  }

  // Éxito: no se dice "confirmada", porque no lo está. Es una petición que el
  // profesional acepta o no.
  if (enviado) {
    return (
      <div className="tp-composer" style={{ textAlign: "center" }}>
        <span className="tp-diary-symbol" style={{ margin: "0 auto 16px" }} aria-hidden>
          <CalendarCheck size={21} strokeWidth={1.6} />
        </span>
        <h2 className="tp-h2">Solicitud enviada</h2>
        <p className="tp-section-desc">
          Tu profesional la revisará y recibirás un aviso con su respuesta. Nada
          queda confirmado hasta entonces.
        </p>
        <button
          type="button"
          className="tp-primary tp-wide"
          style={{ marginTop: 20 }}
          onClick={() => router.push("/app/appointments")}
        >
          Volver a mis citas
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar}>
      {mode === "reschedule" && currentStart && (
        <p className="tp-inline-note">
          <span>
            Cita actual: <strong>{formatDateTime(currentStart)}</strong>
          </span>
        </p>
      )}

      <DateField name="day" label="¿Qué día te viene bien?" defaultValue={defaultDay} wide />

      <fieldset style={{ marginTop: 22 }}>
        <legend className="tp-label" style={{ margin: "0 0 12px" }}>
          ¿A qué hora?
        </legend>
        <div className="tp-timegrid">
          {HORAS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={hora === h}
              onClick={() => setHora(h)}
            >
              {h}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="tp-label" htmlFor="tp-request-note">
        ¿Quieres añadir algo?
        <span>Opcional</span>
      </label>
      <textarea
        id="tp-request-note"
        name="note"
        rows={3}
        maxLength={1000}
        className="tp-textarea"
        placeholder="Si puede ser, prefiero por la tarde."
      />

      {error && <p className="tp-inline-error" style={{ marginTop: 14 }}>{error}</p>}

      <p className="tp-section-desc">
        Es una petición: tu profesional la confirma o te propone otro horario.
      </p>

      <button
        type="submit"
        className="tp-primary tp-wide"
        style={{ marginTop: 20 }}
        disabled={pending || !hora}
      >
        {pending ? "Enviando…" : "Enviar solicitud"}
        {!pending && <ArrowRight size={19} strokeWidth={1.9} aria-hidden />}
      </button>

      {!hora && (
        <p className="tp-section-desc">Elige una hora para poder enviarla.</p>
      )}
    </form>
  );
}
