import type { SeverityRange } from "@/lib/scales";
import { formatDate } from "@/lib/format";

type Point = { date: string; score: number; severity: string | null };

/**
 * Gráfica de evolución de una escala (serie única: puntuación en el tiempo).
 * SVG estático, tema-aware. Las bandas de severidad se muestran como líneas de
 * referencia neutras (rangos estándar publicados; no se interpreta el caso).
 */
export function ScoreChart({
  points,
  max,
  severity,
  title,
}: {
  points: Point[];
  max: number;
  severity: SeverityRange[];
  title: string;
}) {
  const W = 640;
  const H = 260;
  const padL = 34;
  const padR = 96;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (i: number) =>
    points.length <= 1
      ? padL + plotW / 2
      : padL + (i / (points.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const linePath = points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ");

  return (
    <figure className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Evolución de ${title}`}
        className="w-full"
        style={{ minWidth: 420 }}
      >
        {/* Bandas de severidad como líneas de referencia con etiqueta */}
        {severity.map((s) => {
          const yy = y(s.max);
          return (
            <g key={s.label} className="text-neutral-300 dark:text-neutral-700">
              <line
                x1={padL}
                x2={padL + plotW}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={padL + plotW + 6}
                y={yy + 3}
                className="fill-neutral-400"
                style={{ fontSize: 10 }}
              >
                {s.label} (≤{s.max})
              </text>
            </g>
          );
        })}

        {/* Ejes */}
        <line
          x1={padL}
          x2={padL}
          y1={padT}
          y2={padT + plotH}
          className="text-neutral-300 dark:text-neutral-700"
          stroke="currentColor"
        />
        <line
          x1={padL}
          x2={padL + plotW}
          y1={padT + plotH}
          y2={padT + plotH}
          className="text-neutral-300 dark:text-neutral-700"
          stroke="currentColor"
        />
        <text x={4} y={padT + 4} className="fill-neutral-400" style={{ fontSize: 10 }}>
          {max}
        </text>
        <text x={10} y={padT + plotH} className="fill-neutral-400" style={{ fontSize: 10 }}>
          0
        </text>

        {/* Serie */}
        {points.length > 1 && (
          <polyline
            points={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.score)}
              r={5}
              fill="#3b82f6"
              stroke="var(--background, #fff)"
              strokeWidth={2}
            />
            <title>
              {formatDate(p.date)}: {p.score}
              {p.severity ? ` (${p.severity})` : ""}
            </title>
          </g>
        ))}

        {/* Fechas (primera y última para no saturar) */}
        {points.length > 0 && (
          <text
            x={x(0)}
            y={padT + plotH + 16}
            className="fill-neutral-400"
            style={{ fontSize: 10 }}
            textAnchor="middle"
          >
            {formatDate(points[0].date)}
          </text>
        )}
        {points.length > 1 && (
          <text
            x={x(points.length - 1)}
            y={padT + plotH + 16}
            className="fill-neutral-400"
            style={{ fontSize: 10 }}
            textAnchor="middle"
          >
            {formatDate(points[points.length - 1].date)}
          </text>
        )}
      </svg>
      <figcaption className="sr-only">
        Puntuación de {title} a lo largo del tiempo.
      </figcaption>
    </figure>
  );
}
