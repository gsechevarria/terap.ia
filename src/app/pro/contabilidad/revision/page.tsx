import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  getConfiguracionFiscal,
  getPendientesRevisionFiscal,
} from "@/lib/queries/contabilidad";
import { formatCurrency, formatDate } from "@/lib/format";
import { DescargoFiscal } from "@/app/pro/contabilidad/_components/DescargoFiscal";
import { RevisionCobros } from "@/app/pro/contabilidad/_components/RevisionCobros";

/**
 * Revisión fiscal pendiente.
 *
 * El módulo de contabilidad se niega a calcular con registros históricos sin
 * tratamiento fiscal confirmado, y hasta ahora eso acababa en una pantalla de
 * error que remitía a un control que ya no existe en la ficha del paciente.
 * Este es el sitio donde ese control tiene sentido: junto al cálculo que
 * bloquea, y diciendo cuántos registros faltan y cuáles.
 */
export default async function RevisionFiscalPage() {
  const [pendientes, config] = await Promise.all([
    getPendientesRevisionFiscal(),
    getConfiguracionFiscal(),
  ]);

  const total =
    pendientes.cobros.length + pendientes.gastos.length + pendientes.bienes.length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/pro/contabilidad"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
        Contabilidad
      </Link>

      <h1 className="page-title mt-3">Revisión fiscal pendiente</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-2">
        Mientras queden registros sin tratamiento fiscal confirmado, el resumen y
        la exportación no se calculan. No es un fallo: es que no se reconstruye el
        pasado con la configuración de hoy sin que alguien lo confirme.
      </p>

      <DescargoFiscal className="mt-5" />

      {total === 0 ? (
        <div className="mt-8 flex items-start gap-3">
          <CheckCircle2
            size={20}
            strokeWidth={1.75}
            aria-hidden
            className="mt-0.5 shrink-0 text-success"
          />
          <div>
            <h2 className="section-title">No queda nada por revisar</h2>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Todos los cobros, gastos y bienes tienen su tratamiento fiscal
              confirmado.{" "}
              <Link href="/pro/contabilidad" className="font-medium text-accent hover:underline">
                Volver al resumen
              </Link>
              .
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-9">
          <RevisionCobros
            cobros={pendientes.cobros}
            situacionIva={config?.situacion_iva ?? null}
            tipoIvaRepercutido={config?.tipo_iva_repercutido ?? 21}
          />

          <Bloque
            titulo="Gastos sin IVA recuperable"
            registros={pendientes.gastos.length}
            descripcion="Se confirman abriendo cada gasto y guardándolo: al hacerlo se aplica el porcentaje que corresponde a su situación de IVA."
            accion={{ href: "/pro/contabilidad/gastos", texto: "Ir a gastos" }}
          >
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Fecha</th>
                    <th className="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.gastos.slice(0, 8).map((g) => (
                    <tr key={g.id}>
                      <td>{g.concepto ?? "Sin concepto"}</td>
                      <td className="whitespace-nowrap text-ink-2">{formatDate(g.fecha)}</td>
                      <td className="mono text-right whitespace-nowrap">
                        {formatCurrency(g.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bloque>

          <Bloque
            titulo="Bienes de inversión pendientes"
            registros={pendientes.bienes.length}
            descripcion="Se confirman volviendo a guardar su gasto de origen, que recalcula el valor de adquisición con la fórmula real. Ese valor puede cambiar: anote el actual antes."
            accion={{ href: "/pro/contabilidad/gastos", texto: "Ir a gastos" }}
          >
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.bienes.map((b) => (
                    <tr key={b.id}>
                      <td>{b.descripcion ?? "Sin descripción"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bloque>
        </div>
      )}
    </div>
  );
}

function Bloque({
  titulo,
  registros,
  descripcion,
  accion,
  children,
}: {
  titulo: string;
  registros: number;
  descripcion: string;
  accion: { href: string; texto: string };
  children: React.ReactNode;
}) {
  if (registros === 0) return null;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title">
            {titulo} <span className="font-normal text-ink-4">{registros}</span>
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">{descripcion}</p>
        </div>
        <Link href={accion.href} className="btn-ghost btn-sm shrink-0">
          {accion.texto}
        </Link>
      </div>
      {children}
      {registros > 8 && (
        <p className="mt-2 text-[12px] text-ink-3">Y {registros - 8} más.</p>
      )}
    </section>
  );
}
