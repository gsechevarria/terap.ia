import Link from "next/link";
import type { CifrasOperativas, SemanaOcupacion, VentanaOcupacion } from "@/lib/queries/hoy";
import { formatCurrency } from "@/lib/format";

/**
 * Analítica operativa de «Hoy». Solo agenda y dinero: ni una cifra clínica.
 *
 * La gráfica dice HORAS RESERVADAS por semana, no ocupación sobre
 * disponibilidad, y por eso no lleva la línea discontinua del máximo que pide
 * la maqueta: esa línea sería la disponibilidad semanal, que no existe en el
 * esquema. El eje se escala al máximo real de la serie, que es un hecho.
 */
export function GraficaOcupacion({
  semanas,
  ventana,
}: {
  semanas: SemanaOcupacion[];
  ventana: VentanaOcupacion;
}) {
  const maximo = Math.max(...semanas.map((s) => s.horas), 1);
  const techo = Math.ceil(maximo / 5) * 5 || 5;

  return (
    <section className="min-w-0 flex-1">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="section-title">Ocupación de tu agenda</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Horas reservadas por semana. Tu disponibilidad semanal no está configurada, así
            que no hay con qué compararlas.
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Periodo de la gráfica">
          <Link href="?ocupacion=12s" aria-current={ventana === "12s" ? "true" : undefined}>
            12 semanas
          </Link>
          <Link href="?ocupacion=6m" aria-current={ventana === "6m" ? "true" : undefined}>
            6 meses
          </Link>
        </div>
      </div>

      {semanas.every((s) => s.horas === 0) ? (
        <p className="py-6 text-[13.5px] text-ink-3">
          Todavía no hay citas suficientes para dibujar la evolución.
        </p>
      ) : (
        <>
          <div
            className="relative flex h-[150px] items-end gap-1.5 pl-9 sm:gap-2.5"
            style={{ borderBottom: "1px solid var(--line-strong)" }}
          >
            <span className="absolute top-[-8px] left-0 text-[11.5px] text-ink-3">{techo} h</span>
            <span className="absolute top-[63px] left-0 text-[11.5px] text-ink-4">
              {Math.round(techo / 2)} h
            </span>
            {semanas.map((s) => (
              <div
                key={s.inicioYMD}
                title={`Semana del ${s.inicioYMD}: ${s.horas} h reservadas`}
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${Math.max(s.horas > 0 ? 2 : 0, Math.round((s.horas / techo) * 100))}%`,
                  background: s.esSemanaEnCurso ? "var(--green-2)" : "var(--accent-solid)",
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 pl-9 sm:gap-2.5">
            {semanas.map((s) => (
              <span
                key={s.inicioYMD}
                className="flex-1 text-center text-[11px] text-ink-4"
              >
                {s.etiqueta}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Cifra({
  rotulo,
  valor,
  pie,
}: {
  rotulo: string;
  valor: string;
  pie: string;
}) {
  return (
    <div>
      <div className="text-[13px] text-ink-3">{rotulo}</div>
      <div className="figure mt-1">{valor}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-2">{pie}</div>
    </div>
  );
}

/**
 * Las cuatro cifras. Sin cajas: bloques sobre la hoja, separados por espacio.
 *
 * El rótulo de la primera dice «que marcaste como tardías» y no «con menos de
 * 24 h» a propósito. `attendance = 'late_cancel'` es una etiqueta que se elige
 * a mano en el modal de asistencia; no hay ninguna regla en el código que
 * compare la hora de cancelación con la de la cita. Llamarlo «menos de 24 h»
 * sería atribuir a la cifra una precisión que no tiene.
 */
export function Cifras({ cifras }: { cifras: CifrasOperativas }) {
  const { cancelacionesTardias: c, inasistencias, ingresosPrevistos, franjaConMasCancelaciones } =
    cifras;

  return (
    <section className="grid w-full grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2 lg:w-[420px] lg:shrink-0">
      <Cifra
        rotulo="Cancelaciones que marcaste como tardías"
        valor={String(c.esteMes)}
        pie={`este mes, de ${c.citasDelMes} ${c.citasDelMes === 1 ? "cita" : "citas"}. El mes pasado, ${c.mesAnterior}.`}
      />
      <Cifra
        rotulo="No acudieron sin avisar"
        valor={String(inasistencias.esteMes)}
        pie="este mes. Los recordatorios salen 24 h antes."
      />
      {ingresosPrevistos ? (
        <Cifra
          rotulo="Ingresos previstos esta semana"
          valor={formatCurrency(ingresosPrevistos.cents)}
          pie={
            ingresosPrevistos.sinTarifa > 0
              ? `${ingresosPrevistos.sesiones} sesiones reservadas, ${ingresosPrevistos.sinTarifa} sin tarifa configurada`
              : `${ingresosPrevistos.sesiones} ${ingresosPrevistos.sesiones === 1 ? "sesión reservada" : "sesiones reservadas"}`
          }
        />
      ) : (
        <div>
          <div className="text-[13px] text-ink-3">Ingresos previstos esta semana</div>
          <p className="mt-1 text-[13.5px] text-ink-2">
            No has configurado ninguna tarifa.{" "}
            <Link href="/pro/pagos" className="font-medium text-accent hover:underline">
              Ponla en Pagos
            </Link>{" "}
            y esta cifra se calcula sola.
          </p>
        </div>
      )}
      {franjaConMasCancelaciones ? (
        <Cifra
          rotulo="Franja con más cancelaciones"
          valor={franjaConMasCancelaciones.etiqueta}
          pie={`${franjaConMasCancelaciones.casos} de las últimas ${franjaConMasCancelaciones.total}`}
        />
      ) : (
        <div>
          <div className="text-[13px] text-ink-3">Franja con más cancelaciones</div>
          <p className="mt-1 text-[13.5px] text-ink-2">
            No hay cancelaciones en los últimos seis meses.
          </p>
        </div>
      )}
    </section>
  );
}
