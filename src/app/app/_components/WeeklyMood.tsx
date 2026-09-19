import { addDaysYMD, formatYMD, parseYMD } from "@/lib/tz";
import { diaDelMesYMD, diaSemanaCortoYMD } from "@/app/app/_ui/fechas";
import { ESCALA_ACTUAL, esEscalaActual, etiquetaAnimo } from "@/lib/diario";

/**
 * Los siete últimos días. Descriptivo y nada más: ni metas, ni rachas, ni «vas
 * mejorando». La aplicación no interpreta.
 *
 * Dos cosas que este gráfico se niega a hacer:
 *
 *  · **Un día sin registro es un HUECO, no un cero.** Un cero diría que la
 *    persona se sintió fatal; lo que pasó es que no escribió, y son cosas
 *    distintas. El texto alternativo lo dice igual de explícito.
 *
 *  · **No dibuja dos escalas en la misma serie.** Los registros hechos con la
 *    escala de cinco no se convierten ni se normalizan a la de cuatro: un 3 de
 *    entonces era «Normal» y un 3 de ahora es «Bien». Pintarlos a la misma
 *    altura afirmaría una equivalencia que no existe y una evolución que nadie
 *    ha medido. Esos días se marcan aparte y se dicen.
 */
export function WeeklyMood({
  entries,
  hoy,
}: {
  entries: { entry_date: string; mood_value: number; mood_scale: number }[];
  /** 'YYYY-MM-DD' de hoy, resuelto en servidor en hora española. */
  hoy: string;
}) {
  const porDia = new Map(entries.map((e) => [e.entry_date, e]));
  const inicio = addDaysYMD(parseYMD(hoy), -6);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const ymd = formatYMD(addDaysYMD(inicio, i));
    const registro = porDia.get(ymd);
    const comparable = registro != null && esEscalaActual(registro.mood_scale);
    return {
      ymd,
      valor: comparable ? registro!.mood_value : null,
      otraEscala: registro != null && !comparable,
      esHoy: ymd === hoy,
    };
  });

  if (dias.every((d) => d.valor == null && !d.otraEscala)) return null;

  const rango = `${diaDelMesYMD(dias[0]!.ymd)}–${diaDelMesYMD(dias[6]!.ymd)}`;
  const resumen = dias
    .map((d) => {
      const estado = d.otraEscala
        ? "registrado con la escala anterior"
        : d.valor == null
          ? "sin registro"
          : `${d.valor} de ${ESCALA_ACTUAL}`;
      return `${diaSemanaCortoYMD(d.ymd)} ${estado}`;
    })
    .join("; ");

  return (
    <section className="tp-trend" aria-labelledby="tp-semana">
      <div className="tp-section-heading">
        <h2 className="tp-h2" id="tp-semana">
          Tu última semana
        </h2>
        <span>{rango}</span>
      </div>
      <p className="tp-section-desc">
        Cómo te has sentido, de 1 a {ESCALA_ACTUAL}.
      </p>

      <div
        className="tp-week-chart"
        role="img"
        aria-label={`Estados de ánimo de los últimos siete días. ${resumen}.`}
      >
        {dias.map((d) => (
          <div key={d.ymd} className={d.esHoy ? "tp-latest" : undefined}>
            <span aria-hidden>{d.otraEscala ? "–" : (d.valor ?? "·")}</span>
            <i
              aria-hidden
              data-empty={d.valor == null ? "true" : undefined}
              data-otra-escala={d.otraEscala ? "true" : undefined}
              style={
                {
                  "--tp-n": d.valor ?? 0,
                  "--tp-max": ESCALA_ACTUAL,
                } as React.CSSProperties
              }
            />
            <small aria-hidden>{diaSemanaCortoYMD(d.ymd)}</small>
          </div>
        ))}
      </div>

      {dias.some((d) => d.valor == null && !d.otraEscala) && (
        <p className="tp-section-desc">
          Los días sin barra son días que no registraste. No cuentan como un
          cero.
        </p>
      )}

      {dias.some((d) => d.otraEscala) && (
        <p className="tp-section-desc">
          Los días marcados con una raya se registraron con la escala anterior.
          No se dibujan aquí porque sus valores no significan lo mismo.
        </p>
      )}

      {/* Referencia de la escala, para que el número no quede suelto. */}
      <p className="tp-section-desc">
        1 es {etiquetaAnimo(1, ESCALA_ACTUAL).toLowerCase()} y {ESCALA_ACTUAL}{" "}
        es {etiquetaAnimo(ESCALA_ACTUAL, ESCALA_ACTUAL).toLowerCase()}.
      </p>
    </section>
  );
}
