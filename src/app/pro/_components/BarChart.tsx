/**
 * Gráfica de barras de una serie (SVG estático, tema-aware).
 *
 * Color NEUTRO a propósito: todas las barras van en `--accent-solid`. La
 * gráfica dice cuánto, no si el mes fue bueno o malo, así que no hay verde de
 * «bien» ni rojo de «mal». El valor va escrito encima de cada barra, porque el
 * alto por sí solo no es legible para quien no distingue bien las alturas.
 */

/**
 * Barra con las dos esquinas de ARRIBA redondeadas a 3. Un `rect` con `rx`
 * redondearía también las de abajo, y abajo la barra se apoya en el eje: ahí
 * el radio se ve como una barra despegada de su propia línea base.
 */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(3, w / 2, h);
  return `M${x} ${y + h} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} h${w - r * 2} a${r} ${r} 0 0 1 ${r} ${r} V${y + h} Z`;
}

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
          stroke="var(--line-strong)"
        />
        {data.map((d, i) => {
          const cx = padX + slot * i + slot / 2;
          const h = Math.max((d.value / max) * plotH, 0);
          const y = padT + plotH - h;
          return (
            // `key` por la etiqueta, no por el índice: al cambiar los filtros
            // del histórico el array se reordena y React reutilizaba nodos SVG
            // que no correspondían (barras que "saltan" a otro valor).
            <g key={d.label}>
              <path d={barPath(cx - barW / 2, y, barW, h)} fill="var(--accent-solid)" />
              <text
                x={cx}
                y={y - 6}
                textAnchor="middle"
                fill="var(--ink-2)"
                style={{ fontSize: 11 }}
              >
                {valueLabel ? valueLabel(d.value) : d.value}
              </text>
              <text
                x={cx}
                y={padT + plotH + 16}
                textAnchor="middle"
                fill="var(--ink-4)"
                style={{ fontSize: 11 }}
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
