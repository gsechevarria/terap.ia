import { addDaysYMD, formatYMD, parseYMD } from "@/lib/tz";
import { diaDelMesYMD, diaSemanaCortoYMD } from "@/app/app/_ui/fechas";
import { etiquetaAnimoTexto } from "@/app/app/_ui/animo";

/**
 * Los siete últimos días, de 1 a 5. Descriptivo y nada más: ni metas, ni
 * rachas, ni "vas mejorando". La app no interpreta.
 *
 * Un día sin registro se dibuja como HUECO, no como cero. Un cero diría que la
 * persona se sintió fatal; lo que pasó es que no escribió, y son cosas
 * distintas. El texto alternativo lo dice igual de explícito.
 */
export function WeeklyMood({
  entries,
  hoy,
}: {
  entries: { entry_date: string; mood_value: number }[];
  /** 'YYYY-MM-DD' de hoy, resuelto en servidor en hora española. */
  hoy: string;
}) {
  const porDia = new Map(entries.map((e) => [e.entry_date, e.mood_value]));
  const inicio = addDaysYMD(parseYMD(hoy), -6);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const ymd = formatYMD(addDaysYMD(inicio, i));
    return { ymd, valor: porDia.get(ymd) ?? null, esHoy: ymd === hoy };
  });

  if (dias.every((d) => d.valor == null)) return null;

  const rango = `${diaDelMesYMD(dias[0]!.ymd)}–${diaDelMesYMD(dias[6]!.ymd)}`;
  const resumen = dias
    .map(
      (d) =>
        `${diaSemanaCortoYMD(d.ymd)} ${
          d.valor == null ? "sin registro" : `${d.valor} de 5`
        }`,
    )
    .join("; ");

  return (
    <section className="tp-trend" aria-labelledby="tp-semana">
      <div className="tp-section-heading">
        <h2 className="tp-h2" id="tp-semana">
          Tu última semana
        </h2>
        <span>{rango}</span>
      </div>
      <p className="tp-section-desc">Cómo te has sentido, de 1 a 5.</p>

      <div
        className="tp-week-chart"
        role="img"
        aria-label={`Estados de ánimo de los últimos siete días. ${resumen}.`}
      >
        {dias.map((d) => (
          <div key={d.ymd} className={d.esHoy ? "tp-latest" : undefined}>
            <span aria-hidden>{d.valor ?? "·"}</span>
            <i
              aria-hidden
              data-empty={d.valor == null ? "true" : undefined}
              style={{ "--tp-n": d.valor ?? 0 } as React.CSSProperties}
            />
            <small aria-hidden>{diaSemanaCortoYMD(d.ymd)}</small>
          </div>
        ))}
      </div>

      {dias.some((d) => d.valor == null) && (
        <p className="tp-section-desc">
          Los días sin barra son días que no registraste. No cuentan como un
          cero.
        </p>
      )}

      {/* Referencia de la escala, para que el número no quede suelto. */}
      <p className="tp-section-desc">
        1 es {etiquetaAnimoTexto(1).toLowerCase()} y 5 es{" "}
        {etiquetaAnimoTexto(5).toLowerCase()}.
      </p>
    </section>
  );
}
