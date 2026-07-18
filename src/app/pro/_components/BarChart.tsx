/**
 * Gráfica de barras de una serie (SVG estático, tema-aware).
 * Barras con esquina superior redondeada; ejes recesivos; valor sobre la barra.
 */
export function BarChart({
  data,
  ariaLabel,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  ariaLabel: string;
  valueLabel?: (n: number) => string;
}) {
  const W = 640;
  const H = 220;
  const padT = 22;
  const padB = 28;
  const padX = 8;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = (W - padX * 2) / n;
  const barW = Math.min(46, slot * 0.6);

  return (
    <figure className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full"
        style={{ minWidth: 420 }}
      >
        <line
          x1={padX}
          x2={W - padX}
          y1={padT + plotH}
          y2={padT + plotH}
          className="text-neutral-300 dark:text-neutral-700"
          stroke="currentColor"
        />
        {data.map((d, i) => {
          const cx = padX + slot * i + slot / 2;
          const h = (d.value / max) * plotH;
          const y = padT + plotH - h;
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(h, 0)}
                rx={4}
                fill="#3b82f6"
              />
              <text
                x={cx}
                y={y - 5}
                textAnchor="middle"
                className="fill-neutral-500"
                style={{ fontSize: 10 }}
              >
                {valueLabel ? valueLabel(d.value) : d.value}
              </text>
              <text
                x={cx}
                y={padT + plotH + 16}
                textAnchor="middle"
                className="fill-neutral-400"
                style={{ fontSize: 10 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
