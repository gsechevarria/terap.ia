"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { confirmarCobroFiscalAction } from "@/lib/actions/payments";
import { formatCurrency, formatDate } from "@/lib/format";

type Cobro = {
  id: string;
  fecha: string;
  importeCents: number;
  paciente: string | null;
};

/**
 * Confirmación del tratamiento fiscal de los cobros históricos.
 *
 * Uno a uno a propósito. La tentación es un botón que aplique la configuración
 * actual a los ciento y pico registros de golpe, pero eso es exactamente
 * "reconstruir el pasado con la configuración de hoy", que es lo que la
 * migración evitó deliberadamente. Para una regularización masiva de datos ya
 * existentes está el script de mantenimiento, que se ejecuta a conciencia y
 * deja constancia de que fue una regularización y no una confirmación
 * profesional operación por operación.
 */
export function RevisionCobros({
  cobros,
  situacionIva,
  tipoIvaRepercutido,
}: {
  cobros: Cobro[];
  situacionIva: string | null;
  tipoIvaRepercutido: number;
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());

  if (cobros.length === 0) return null;

  const exenta = situacionIva !== "sujeta";
  const visibles = cobros.filter((c) => !confirmados.has(c.id)).slice(0, 10);
  const restantes = cobros.length - confirmados.size;

  function confirmar(cobro: Cobro) {
    run(async () => {
      await callAction(
        confirmarCobroFiscalAction,
        cobro.id,
        exenta ? "exenta" : "sujeta",
        exenta ? 0 : tipoIvaRepercutido,
        0,
      );
      setConfirmados((previos) => new Set(previos).add(cobro.id));
      router.refresh();
    });
  }

  return (
    <section>
      <h2 className="section-title">
        Cobros sin tratamiento fiscal{" "}
        <span className="font-normal text-ink-4">{restantes}</span>
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Se confirmarán como{" "}
        <strong className="font-medium text-ink">
          {exenta ? "operación exenta" : `operación sujeta al ${tipoIvaRepercutido} %`}
        </strong>
        , según su configuración fiscal, y sin retención practicada. Si alguno
        llevó retención o tuvo otro tratamiento, confírmelo con el criterio que
        corresponda antes de exportar.
      </p>

      {restantes > 10 && (
        <p className="mt-3 rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-[12.5px] text-ink">
          Son {restantes} registros. Para una regularización masiva de
          históricos existe un script de mantenimiento que deja constancia de
          que fue una regularización, y no una confirmación operación por
          operación:{" "}
          {/* Literal técnico: se marca con fondo propio, no con otra familia
              tipográfica — el sistema tiene una sola. */}
          <code className="rounded-md bg-surface-muted px-1.5 py-0.5 text-ink-2">
            regularizar-ingresos-demo.sql
          </code>
          .
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-4 py-2.5 text-[12.5px] text-danger-ink">
          {error}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="table-base table-plain">
          <thead>
            <tr>
              <th>Pagador</th>
              <th>Fecha</th>
              <th className="text-right">Importe</th>
              <th className="w-0">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((cobro) => (
              <tr key={cobro.id}>
                <td>{cobro.paciente ?? "Sin pagador"}</td>
                <td className="whitespace-nowrap text-ink-2">{formatDate(cobro.fecha)}</td>
                <td className="mono text-right whitespace-nowrap">
                  {formatCurrency(cobro.importeCents)}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => confirmar(cobro)}
                    className="btn-ghost btn-sm"
                  >
                    Confirmar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {restantes > visibles.length && (
        <p className="mt-2 text-[12px] text-ink-3">
          Y {restantes - visibles.length} más.
        </p>
      )}
    </section>
  );
}
