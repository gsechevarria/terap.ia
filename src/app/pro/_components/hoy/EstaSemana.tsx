import Link from "next/link";
import type { SemanaEnCurso } from "@/lib/queries/hoy";

/**
 * Las seis jornadas de la semana, de lunes a sábado.
 *
 * La barra dice horas RESERVADAS, no ocupación sobre disponibilidad: no hay
 * tabla de horario de consulta, así que no hay denominador que dividir. Se
 * escala frente al día más cargado de la propia semana, que es una comparación
 * entre hechos y no contra una cifra inventada.
 *
 * La barra nunca es el único portador del dato: debajo va siempre el número de
 * horas. Eso es lo que permite que el verde de `--green-3` no tenga que cumplir
 * el 3:1 de objeto gráfico — la información está también en texto.
 */
export function EstaSemana({ semana }: { semana: SemanaEnCurso }) {
  const maximo = Math.max(...semana.dias.map((d) => d.horas), 1);

  return (
    <section>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="section-title">Esta semana</h2>
        <span className="text-[13px] text-ink-3">
          {semana.horasTotales} {semana.horasTotales === 1 ? "hora reservada" : "horas reservadas"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {semana.dias.map((d) => {
          const alto = d.horas > 0 ? Math.max(6, Math.round((d.horas / maximo) * 100)) : 0;
          return (
            <Link
              key={d.ymd}
              href={`/pro/agenda?view=day&date=${d.ymd}`}
              className="flex flex-col gap-2 rounded-xl p-2.5 text-ink transition-colors"
              style={{
                background: d.esHoy ? "var(--accent-soft)" : "var(--surface-subtle)",
              }}
            >
              <div className="flex justify-between text-[12.5px]">
                <span className="font-semibold">{d.etiqueta}</span>
                <span className="text-ink-3">{d.diaDelMes}</span>
              </div>
              <div
                className="flex h-16 items-end overflow-hidden rounded-sm"
                style={{ background: "var(--surface)" }}
                aria-hidden
              >
                <span
                  className="block w-full"
                  style={{
                    height: `${alto}%`,
                    background: d.horas >= maximo && d.horas > 0 ? "var(--green-5)" : "var(--green-3)",
                  }}
                />
              </div>
              <div className="text-[12.5px]">
                {d.horas > 0 ? (
                  <>
                    <strong className="font-semibold">{d.horas} h</strong>
                  </>
                ) : (
                  <span className="text-ink-3">Sin citas</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
