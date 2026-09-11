"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { requestAppointmentAction } from "@/lib/actions/appointments";
import { fromDatetimeLocal, formatDateTime } from "@/lib/format";
import { DateField } from "@/components/ui/DateField";

/** Franjas habituales de consulta. Son propuestas: decide el profesional. */
const TIMES = [
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
  const [time, setTime] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const day = String(form.get("day") ?? "");
    const note = String(form.get("note") ?? "");
    const when = fromDatetimeLocal(`${day}T${time}`);
    if (!when) return;

    run(
      () =>
        callAction(requestAppointmentAction, {
          kind: mode,
          preferredStart: when.toISOString(),
          note,
          appointmentId,
        }).then(() => undefined),
      () => {
        setSent(true);
        router.refresh();
      },
    );
  }

  if (sent) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <CalendarCheck className="size-8 text-accent" strokeWidth={1.5} aria-hidden />
        <h2 className="text-base font-semibold">Solicitud enviada</h2>
        <p className="text-sm text-ink-2">
          Tu profesional la revisará y recibirás un aviso con su respuesta. Nada
          queda confirmado hasta entonces.
        </p>
        <button
          type="button"
          onClick={() => router.push("/app/appointments")}
          className="btn-primary btn-lg mt-1 w-full"
        >
          Volver a mis citas
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {mode === "reschedule" && currentStart && (
        <p className="rounded-lg bg-wash px-3 py-2 text-sm text-ink-2">
          Cita actual: <strong>{formatDateTime(currentStart)}</strong>
        </p>
      )}

      <div>
        <DateField name="day" label="¿Qué día te viene bien?" defaultValue={defaultDay} wide />
      </div>

      <fieldset>
        <legend className="field-label mb-2">¿A qué hora?</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {TIMES.map((t) => {
            const active = time === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                aria-pressed={active}
                className={`rounded-md border px-2 py-2.5 text-sm transition-colors duration-150 ${
                  active
                    ? "border-accent bg-accent font-medium text-white"
                    : "border-line-strong bg-panel text-ink-2 hover:border-accent hover:text-ink"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className="field-label" htmlFor="note">
          ¿Quieres añadir algo? (opcional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className="field mt-1"
          placeholder="Si puede ser, prefiero por la tarde."
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-xs text-ink-3">
        Es una petición: tu profesional la confirma o te propone otro horario.
      </p>

      <button
        type="submit"
        disabled={pending || !time}
        className="btn-primary btn-lg w-full"
      >
        {pending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
