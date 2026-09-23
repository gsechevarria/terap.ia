import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <Link
        href="/pro/contabilidad"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
        Contabilidad
      </Link>
      <h1 className="page-title mt-3">Gastos deducibles</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-2">
        Registra tus gastos con su justificante. El % de afectación ajusta la
        parte deducible.
      </p>

      <DescargoFiscal className="mt-5" />

      <div className="mt-7">
        <GastoForm />
      </div>

      <section className="mt-9">
        <h2 className="section-title mb-3">
          Gastos registrados{" "}
          <span className="font-normal text-ink-4">{gastos.length}</span>
        </h2>
        <GastosTable
          gastos={gastos}
          situacionIva={situacionIva}
          prorrata={cfg?.prorrata_iva_pct ?? null}
        />
      </section>

      {bienes.length > 0 && (
        <section className="mt-9">
          <h2 className="section-title mb-3">
            Bienes de inversión{" "}
            <span className="font-normal text-ink-4">{bienes.length}</span>
          </h2>
          <div className="table-wrap overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Fecha de adquisición</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">% amortización</th>
                  <th className="text-right">Años</th>
                  <th className="text-right">Amortización anual</th>
                </tr>
              </thead>
              <tbody>
                {bienes.map((b) => (
                  <tr key={b.id}>
                    <td>{b.descripcion}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(b.fecha_adquisicion)}
                    </td>
                    <td className="mono text-right">
                      {formatCurrency(b.valor_adquisicion_cents)}
                    </td>
                    <td className="mono text-right">
                      {b.porcentaje_amortizacion}%
                    </td>
                    <td className="mono text-right">
                      {b.anios_amortizacion ?? "—"}
                    </td>
                    <td className="mono text-right">
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
        </section>
      )}
    </div>
  );
}
