import type { TramoJornada } from "@/lib/queries/hoy";
import { formatDuracion } from "@/lib/format";

const RELLENO: Record<TramoJornada["clase"], string> = {
  realizada: "var(--ink-disabled)",
  proxima: "var(--accent-solid)",
  confirmada: "var(--green-3)",
  "sin-confirmar": "var(--green-2)",
  libre: "var(--surface-muted)",
  bloqueado: "var(--hatch)",
};

function hhmm(minuto: number): string {
  return `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
}

/**
 * Barra de la jornada: segmentos proporcionales a su duración, de la primera
 * hora ocupada a la última.
 *
 * NO lleva denominador. La maqueta dice «4 h 10 min de sesión de 8 h
 * disponibles», pero la disponibilidad del profesional no existe en la base de
 * datos: no hay tabla de horario de consulta. Inventar un «de 8 h» sería
 * escribir una cifra que nadie ha configurado, así que se afirma solo lo que se
 * sabe —cuánto se trabaja hoy— y se dice de dónde a dónde va la barra.
 *
 * Cada segmento lleva `title`, que es lo que da el detalle al pasar el ratón sin
 * añadir una leyenda que ocuparía más que la propia barra.
 */
export function BarraJornada({
  tramos,
  minutosDeSesion,
  ventana,
}: {
  tramos: TramoJornada[];
  minutosDeSesion: number;
  ventana: { desde: number; hasta: number };
}) {
  const total = Math.max(1, ventana.hasta - ventana.desde);
  const etiquetas = [
    ventana.desde,
    ventana.desde + Math.round(total / 3),
    ventana.desde + Math.round((total * 2) / 3),
    ventana.hasta,
  ];

  return (
    <div className="max-w-[520px]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px] text-ink-3">
        <span>Tu jornada de hoy</span>
        <span>
          <strong className="font-semibold text-ink">{formatDuracion(minutosDeSesion)}</strong> de
          sesión, de {hhmm(ventana.desde)} a {hhmm(ventana.hasta)}
        </span>
      </div>

      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-xs" role="img" aria-label={`Jornada de ${hhmm(ventana.desde)} a ${hhmm(ventana.hasta)}, ${formatDuracion(minutosDeSesion)} de sesión`}>
        {tramos.map((t, i) => (
          <span
            key={`${t.desde}-${i}`}
            title={`${hhmm(t.desde)} a ${hhmm(t.hasta)}, ${ROTULO[t.clase]}`}
            style={{ flex: `${Math.max(1, t.hasta - t.desde)} 0 0`, background: RELLENO[t.clase] }}
            className="first:rounded-l-xs last:rounded-r-xs"
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-4">
        {etiquetas.map((m, i) => (
          <span key={i}>{hhmm(m)}</span>
        ))}
      </div>
    </div>
  );
}

const ROTULO: Record<TramoJornada["clase"], string> = {
  realizada: "sesión realizada",
  proxima: "próxima sesión",
  confirmada: "sesión confirmada",
  "sin-confirmar": "sesión sin confirmar",
  libre: "libre",
  bloqueado: "bloqueado",
};
