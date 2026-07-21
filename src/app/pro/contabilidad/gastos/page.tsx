import Link from "next/link";
import {
  getGastos,
  getBienesInversion,
  getConfiguracionFiscal,
} from "@/lib/queries/contabilidad";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SituacionIva } from "@/lib/fiscal";
import { GastoForm } from "../_components/GastoForm";
import { GastosTable } from "../_components/GastosTable";
import { DescargoFiscal } from "../_components/DescargoFiscal";

export default async function GastosPage() {
  const [gastos, bienes, cfg] = await Promise.all([
    getGastos(),
    getBienesInversion(),
    getConfiguracionFiscal(),
  ]);
  const situacionIva = (cfg?.situacion_iva as SituacionIva) ?? "exenta";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/pro/contabilidad" className="text-sm text-ink-3 hover:text-ink">
        ← Contabilidad
      </Link>
      <h1 className="page-title mt-3">Gastos deducibles</h1>
      <p className="mt-1 text-sm text-ink-2">
        Registra tus gastos con su justificante. El % de afectación ajusta la
        parte deducible.
      </p>

      <DescargoFiscal className="mt-4" />

      <div className="mt-5">
        <GastoForm />
      </div>

      <h2 className="section-label mt-8 mb-2">
        Gastos registrados ({gastos.length})
      </h2>
      <GastosTable gastos={gastos} situacionIva={situacionIva} />

      {bienes.length > 0 && (
        <>
          <h2 className="section-label mt-8 mb-2">Bienes de inversión</h2>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Fecha adq.</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">% amort.</th>
                  <th className="text-right">Años</th>
                  <th className="text-right">Amortización anual</th>
                </tr>
              </thead>
              <tbody>
                {bienes.map((b) => (
                  <tr key={b.id} className="last:[&>td]:border-b-0">
                    <td>{b.descripcion}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(b.fecha_adquisicion)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(b.valor_adquisicion_cents)}
                    </td>
                    <td className="text-right tabular-nums">
                      {b.porcentaje_amortizacion}%
                    </td>
                    <td className="text-right tabular-nums">
                      {b.anios_amortizacion ?? "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(
                        Math.round(
                          (b.valor_adquisicion_cents * b.porcentaje_amortizacion) /
                            100,
                        ),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
