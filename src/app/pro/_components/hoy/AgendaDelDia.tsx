"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FranjaBloqueada, HuecoLibre, SesionDelDia } from "@/lib/queries/hoy";
import { minutesOfDayInTZ } from "@/lib/tz";
import { formatDuracion } from "@/lib/format";

const ALTO_HORA = 42;
/** Alto mínimo de un bloque para que quepa una línea de texto. */
const ALTO_MINIMO = 30;

function hhmm(minuto: number): string {
  return `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
}

/**
 * Agenda del día: rejilla horaria real, 42 px por hora, con los bloques a la
 * altura que les toca por duración.
 *
 * Es el ÚNICO componente cliente de «Hoy», y solo por la línea de «ahora», que
 * tiene que moverse sin recargar. El resto llega renderizado del servidor.
 *
 * La línea arranca en el valor que calculó el servidor y se recalcula tras
 * montar: si se calculara en el primer render del cliente, el HTML del servidor
 * y el del navegador diferirían en los segundos que tarda en llegar y React
 * avisaría de desajuste de hidratación.
 */
export function AgendaDelDia({
  sesiones,
  bloqueos,
  huecos,
  ventana,
  ahoraMinutoInicial,
  hoyYMD,
}: {
  sesiones: SesionDelDia[];
  bloqueos: FranjaBloqueada[];
  huecos: HuecoLibre[];
  ventana: { desde: number; hasta: number };
  ahoraMinutoInicial: number;
  hoyYMD: string;
}) {
  const [ahora, setAhora] = useState(ahoraMinutoInicial);

  useEffect(() => {
    function actualizar() {
      setAhora(minutesOfDayInTZ(new Date()));
    }
    actualizar();
    const id = setInterval(actualizar, 60_000);
    return () => clearInterval(id);
  }, []);

  const alto = ((ventana.hasta - ventana.desde) / 60) * ALTO_HORA;
  const y = (minuto: number) => ((minuto - ventana.desde) / 60) * ALTO_HORA;
  const horas: number[] = [];
  for (let m = Math.ceil(ventana.desde / 60) * 60; m <= ventana.hasta; m += 60) horas.push(m);

  const dentro = ahora >= ventana.desde && ahora <= ventana.hasta;

  return (
    <section className="w-full lg:w-[600px] lg:shrink-0">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="section-title">Agenda de hoy</h2>
        <div className="flex gap-3.5 text-[13px]">
          <Link href="/pro/agenda" className="text-accent hover:underline">
            Bloquear franja
          </Link>
          <Link href={`/pro/agenda?view=week&date=${hoyYMD}`} className="text-accent hover:underline">
            Semana completa
          </Link>
        </div>
      </div>

      {sesiones.length === 0 && bloqueos.length === 0 ? (
        <p className="empty">
          No hay nada agendado hoy.{" "}
          <Link href="/pro/agenda" className="font-medium text-accent hover:underline">
            Crea una cita
          </Link>{" "}
          o propón una a quien lleve tiempo sin venir.
        </p>
      ) : (
        <div className="relative" style={{ height: alto }}>
          {/* Rejilla horaria */}
          {horas.map((m) => (
            <div
              key={m}
              className="absolute inset-x-0 flex items-start gap-3"
              style={{ top: y(m) }}
            >
              <span className="-mt-2 w-11 shrink-0 text-right text-[12px] text-ink-4">
                {hhmm(m)}
              </span>
              <span className="mt-0 h-px flex-1" style={{ background: "var(--line-soft)" }} />
            </div>
          ))}

          {/* Huecos libres: borde discontinuo, nunca relleno. */}
          {huecos.map((h, i) => (
            <div
              key={`hueco-${i}`}
              className="absolute right-0 left-[60px] box-border flex items-center justify-between gap-3 rounded-md px-3 text-[13px]"
              style={{
                top: y(h.desde),
                height: Math.max(ALTO_MINIMO, y(h.hasta) - y(h.desde)),
                border: `1.5px dashed ${h.liberadoPor ? "var(--green-3)" : "var(--line-strong)"}`,
              }}
            >
              <span className="min-w-0 truncate text-ink-3">
                {h.liberadoPor
                  ? `Hueco liberado. ${h.liberadoPor} canceló.`
                  : `Libre de ${hhmm(h.desde)} a ${hhmm(h.hasta)}, ${formatDuracion(h.hasta - h.desde)}`}
              </span>
              <Link
                href="/pro/agenda"
                className="shrink-0 font-semibold text-accent hover:underline"
              >
                Proponer cita
              </Link>
            </div>
          ))}

          {/* Franjas bloqueadas y fuera de horario: trama, no color. */}
          {bloqueos.map((b) => (
            <div
              key={b.id}
              className="absolute right-0 left-[60px] box-border flex items-center rounded-md px-3 text-[13px] text-ink-4"
              style={{
                top: y(b.desde),
                height: Math.max(ALTO_MINIMO, y(b.hasta) - y(b.desde)),
                background: "var(--hatch)",
              }}
            >
              Bloqueado{b.motivo ? `, ${b.motivo}` : ""}
            </div>
          ))}

          {/* Sesiones */}
          {sesiones.map((s) => (
            <BloqueSesion key={s.id} sesion={s} top={y(s.desde)} alto={y(s.hasta) - y(s.desde)} />
          ))}

          {/* Línea de «ahora» */}
          {dentro && (
            <>
              <div
                aria-hidden
                className="absolute right-0 left-[50px] h-0.5"
                style={{ top: y(ahora), background: "var(--danger)" }}
              />
              <div
                aria-hidden
                className="absolute size-2 rounded-full"
                style={{ top: y(ahora) - 3, left: 46, background: "var(--danger)" }}
              />
              <span className="sr-only">Son las {hhmm(ahora)}</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function BloqueSesion({
  sesion,
  top,
  alto,
}: {
  sesion: SesionDelDia;
  top: number;
  alto: number;
}) {
  const base =
    "absolute left-[60px] right-0 box-border flex items-center justify-between gap-3 rounded-md px-3 text-[13px] overflow-hidden";
  const estilo: React.CSSProperties = { top, height: Math.max(ALTO_MINIMO, alto) };

  if (sesion.clase === "realizada" || sesion.clase === "no-acudio") {
    return (
      <Link
        href={`/pro/patients/${sesion.patientId}`}
        className={base}
        style={{ ...estilo, background: "var(--surface-muted)", color: "var(--ink-disabled)" }}
      >
        <span className="min-w-0 truncate">
          <span className="line-through">{sesion.paciente}</span>
          {sesion.online ? ", online" : ""}
        </span>
        <span className="shrink-0">
          {sesion.clase === "no-acudio" ? "No acudió" : "Realizada"}
        </span>
      </Link>
    );
  }

  const proxima = sesion.clase === "proxima";
  const sinConfirmar = sesion.clase === "sin-confirmar";

  return (
    <Link
      href={`/pro/patients/${sesion.patientId}`}
      className={base}
      style={{
        ...estilo,
        background: proxima ? "var(--accent-solid)" : sinConfirmar ? "var(--surface)" : "var(--accent-soft)",
        color: proxima ? "var(--accent-solid-ink)" : "var(--ink-1)",
        border: sinConfirmar ? "1px solid var(--warning-line)" : undefined,
      }}
    >
      <span className="min-w-0 truncate">
        <strong className="font-semibold">{sesion.paciente}</strong>
        {sinConfirmar ? (
          <>
            , <span style={{ color: "var(--warning-ink)" }}>sin confirmar</span>
          </>
        ) : (
          `, ${sesion.online ? "online" : "presencial"}`
        )}
      </span>
      <span className="shrink-0 whitespace-nowrap">
        {sesion.avisoPendiente ? (
          <span className="font-semibold" style={{ color: proxima ? "#FFFFFF" : "var(--danger)" }}>
            Aviso pendiente
          </span>
        ) : proxima ? (
          `${hhmm(sesion.desde)} a ${hhmm(sesion.hasta)}`
        ) : (
          hhmm(sesion.desde)
        )}
      </span>
    </Link>
  );
}
