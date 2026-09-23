import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { getFiscalArrays } from "@/lib/queries/contabilidad";
import { formatEur } from "@/lib/format";
import {
  calcularResumenAnual,
  getParams,
  hayParamsExactos,
  trimestreActual,
  proximoVencimiento,
  alertasVencimiento,
  vencimientosModelo130,
} from "@/lib/fiscal";
import { DescargoFiscal } from "./_components/DescargoFiscal";
import { NavContabilidad } from "./_components/NavContabilidad";

/** «20 de octubre de 2026». Fecha sin zona: se ancla y se formatea en UTC. */
function fmtYMD(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
/** «20 oct». */
function fmtCorto(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}
function enDias(dias: number): string {
  return dias === 0 ? "vence hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
}

/**
 * Resumen de contabilidad, con el lenguaje de «Hoy».
 *
 * Misma anchura que el resto del panel; frase de estado bajo el título que
 * dice lo que se viene a mirar —cuánto sale el pago fraccionado y cuándo
 * vence—; avisos agrupados en una sola franja en vez de tres cajas ámbar
 * apiladas; y los pagos fraccionados como tabla sin caja, con su fecha.
 */
export default async function ContabilidadPage() {
  // "Hoy" fuera del JSX (regla de pureza de React).
  const ref = new Date();
  const { trimestre, anio } = trimestreActual(ref);
  const params = getParams(anio);

  const data = await getFiscalArrays(anio);

  // Lo apartado por falta de confirmación fiscal. Se cuenta y se dice; antes
  // un solo registro sin confirmar tiraba la sección entera y el profesional
  // no veía ni lo que había cobrado.
  const totalExcluidos =
    data.excluidos.ingresos + data.excluidos.gastos + data.excluidos.bienes;
  const detalleExcluidos = [
    data.excluidos.ingresos > 0 ? `${data.excluidos.ingresos} de cobros` : null,
    data.excluidos.gastos > 0 ? `${data.excluidos.gastos} de gastos` : null,
    data.excluidos.bienes > 0 ? `${data.excluidos.bienes} de bienes` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const resumen = calcularResumenAnual(data, anio, params);
  // `calcularResumenAnual` produce siempre los cuatro trimestres, pero el
  // acceso indexado no lo sabe.
  const q = resumen.trimestres[trimestre - 1] ?? resumen.trimestres[0]!;
  const prox = proximoVencimiento(ref, params);
  const alertas = alertasVencimiento(ref, params, 45);
  const fechas130 = new Map(
    vencimientosModelo130(anio, params).map((v) => [v.trimestre, v.fechaLimiteYMD]),
  );
  const sinDatos = data.ingresos.length === 0 && data.gastos.length === 0;
  const paramsExactos = hayParamsExactos(anio);

  const frase = sinDatos
    ? `Aún no hay cobros ni gastos del ejercicio ${anio}. Empieza por tu perfil fiscal y tus gastos.`
    : [
        `El pago fraccionado del ${trimestre}T se estima en ${formatEur(q.pagoTrimestre)}.`,
        prox
          ? `El próximo vencimiento es el ${fmtYMD(prox.fechaLimiteYMD).replace(/ de \d{4}$/, "")}, ${enDias(prox.diasRestantes)}.`
          : "No hay vencimientos próximos.",
      ].join(" ");

  const hayAvisos = totalExcluidos > 0 || !paramsExactos || alertas.length > 0;

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Cabecera como la de «Hoy», «Pacientes» y «Pagos». */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">Contabilidad</h1>
          <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">{frase}</p>
        </div>
        <Link href="/pro/contabilidad/gastos" className="btn-primary mt-1.5">
          <Plus size={16} strokeWidth={1.75} aria-hidden /> Registrar gasto
        </Link>
      </header>

      <NavContabilidad ejercicio={anio} />

      <DescargoFiscal />

      {/* Un solo bloque de avisos, con una línea por aviso. Antes eran hasta
          tres cajas ámbar apiladas que decían lo mismo con tres bordes. */}
      {hayAvisos && (
        <section
          aria-label="Antes de fiarte de las cifras"
          className="rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-[13px] text-ink"
        >
          <ul className="flex flex-col gap-2.5">
            {totalExcluidos > 0 && (
              <Aviso
                accion={{ href: "/pro/contabilidad/revision", texto: "Revisar" }}
              >
                <span className="font-semibold">
                  Las cifras no incluyen {totalExcluidos}{" "}
                  {totalExcluidos === 1 ? "registro" : "registros"} sin tratamiento
                  fiscal confirmado
                </span>
                {detalleExcluidos && <> ({detalleExcluidos})</>}. Quedan apartados
                hasta que los revises, no descartados.
              </Aviso>
            )}
            {!paramsExactos && (
              <Aviso>
                No hay parámetros fiscales confirmados para {anio}; se usan los del
                último ejercicio disponible. Verifica las cifras con tu asesor.
              </Aviso>
            )}
            {alertas.map((a) => (
              <Aviso key={`${a.modelo}-${a.ejercicio}-${a.trimestre ?? "r"}`}>
                <span className="font-semibold">
                  {a.modelo === "modelo130"
                    ? `Modelo 130 del ${a.trimestre}T ${a.ejercicio}`
                    : `Renta ${a.ejercicio}`}
                </span>
                , hasta el {fmtYMD(a.fechaLimiteYMD)} ({enDias(a.diasRestantes)}).
              </Aviso>
            ))}
          </ul>
        </section>
      )}

      {sinDatos ? (
        <p className="empty">
          Aún no hay datos de este ejercicio. Empieza por{" "}
          <Link
            href="/pro/contabilidad/configuracion"
            className="font-medium text-accent hover:underline"
          >
            configurar tu perfil fiscal
          </Link>{" "}
          y{" "}
          <Link
            href="/pro/contabilidad/gastos"
            className="font-medium text-accent hover:underline"
          >
            registrar tus gastos
          </Link>
          .
        </p>
      ) : (
        <>
          {/* El trimestre en curso a la izquierda; el año por trimestres a la
              derecha. Como la agenda del día y la semana en «Hoy». */}
          <div className="flex flex-col gap-8 lg:flex-row">
            <section className="min-w-0 flex-1">
              <div className="mb-3.5">
                <h2 className="section-title">
                  {trimestre}T {anio}{" "}
                  <span className="font-normal text-ink-4">modelo 130, acumulado</span>
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  Del 1 de enero al cierre del {trimestre}T. Estimación orientativa.
                </p>
              </div>
              <div className="text-[13px] text-ink-3">Pago fraccionado estimado</div>
              <div className="figure mt-1">{formatEur(q.pagoTrimestre)}</div>
              <dl className="mt-5 grid grid-cols-2 gap-x-7 gap-y-5 sm:grid-cols-4">
                <Cifra rotulo="Ingresos" valor={formatEur(q.ingresosAcumulados)} />
                <Cifra rotulo="Gastos deducibles" valor={formatEur(q.gastosDeduciblesAcumulados)} />
                <Cifra rotulo="Rendimiento neto" valor={formatEur(q.rendimientoNeto)} />
                <Cifra rotulo="Retenciones" valor={formatEur(q.retencionesAcumuladas)} />
              </dl>
            </section>

            <section className="w-full lg:w-[420px] lg:shrink-0">
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="section-title">Pagos fraccionados del año</h2>
                <Link
                  href={`/pro/contabilidad/expediente/${anio}`}
                  className="text-[13px] text-accent hover:underline"
                >
                  Expediente {anio}
                </Link>
              </div>
              <table className="table-base table-plain">
                <thead>
                  <tr>
                    <th scope="col">Trimestre</th>
                    <th scope="col">Plazo</th>
                    <th scope="col" className="text-right">
                      Estimación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.trimestres.map((t) => {
                    const actual = t.trimestre === trimestre;
                    const fecha = fechas130.get(t.trimestre);
                    return (
                      <tr key={t.trimestre}>
                        <td className={actual ? "font-semibold" : "text-ink-2"}>
                          {t.trimestre}T
                          {actual && (
                            <span className="ml-2 text-[12.5px] font-normal text-ink-3">
                              en curso
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-ink-2">
                          {fecha ? `hasta el ${fmtCorto(fecha)}` : "—"}
                        </td>
                        <td
                          className={`text-right whitespace-nowrap ${actual ? "font-semibold" : "text-ink-2"}`}
                        >
                          {formatEur(t.pagoTrimestre)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>

          {/* El año entero, separado por una línea y no por otra caja. */}
          <section className="border-t border-line pt-[22px]">
            <h2 className="section-title mb-3.5">Ejercicio {anio}</h2>
            <dl className="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-3">
              <Cifra rotulo="Ingresos del año" valor={formatEur(resumen.ingresosTotales)} grande />
              <Cifra
                rotulo="Gastos deducibles"
                valor={formatEur(resumen.gastosDeduciblesTotales)}
                pie={`${formatEur(resumen.amortizacionesTotales)} en amortizaciones`}
                grande
              />
              <Cifra
                rotulo="Rendimiento neto del año"
                valor={formatEur(resumen.rendimientoNeto)}
                grande
              />
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function Aviso({
  children,
  accion,
}: {
  children: React.ReactNode;
  accion?: { href: string; texto: string };
}) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <TriangleAlert
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="mt-0.5 shrink-0 text-warning-ink"
      />
      <p className="min-w-0 flex-1">{children}</p>
      {accion && (
        <Link href={accion.href} className="btn-ghost btn-sm shrink-0">
          {accion.texto}
        </Link>
      )}
    </li>
  );
}

/**
 * Cifra sin caja: rótulo, número y pie, como las de «Hoy» y «Pagos». La del
 * ejercicio va a tamaño `.figure`; las del trimestre, un escalón por debajo,
 * porque la que manda en su bloque es el pago fraccionado.
 */
function Cifra({
  rotulo,
  valor,
  pie,
  grande = false,
}: {
  rotulo: string;
  valor: string;
  pie?: string;
  grande?: boolean;
}) {
  return (
    <div>
      <dt className="text-[13px] text-ink-3">{rotulo}</dt>
      <dd className={grande ? "figure mt-1" : "mt-1 text-[17px] font-semibold text-ink"}>
        {valor}
      </dd>
      {pie && <dd className="mt-0.5 text-[12.5px] text-ink-2">{pie}</dd>}
    </div>
  );
}
