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
    <section className="card">
      <div className="border-b border-line p-5">
        <h2 className="card-title">
          Cobros sin tratamiento fiscal{" "}
          <span className="mono ml-1 font-normal text-ink-3">{restantes}</span>
        </h2>
        <p className="mt-1 text-body-sm text-ink-2">
          Se confirmarán como{" "}
          <strong className="font-medium text-ink">
            {exenta ? "operación exenta" : `operación sujeta al ${tipoIvaRepercutido} %`}
          </strong>
          , según su configuración fiscal, y sin retención practicada. Si alguno
          llevó retención o tuvo otro tratamiento, confírmelo con el criterio que
          corresponda antes de exportar.
        </p>
        {restantes > 10 && (
          <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">
            Son {restantes} registros. Para una regularización masiva de
            históricos existe un script de mantenimiento que deja constancia de
            que fue una regularización, y no una confirmación operación por
            operación: <code className="mono">regularizar-ingresos-demo.sql</code>.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="border-b border-line px-4 py-2.5 text-[12px] text-danger">
          {error}
        </p>
      )}

      <ul className="divide-y divide-line">
        {visibles.map((cobro) => (
          <li key={cobro.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate text-[13px]">
              {cobro.paciente ?? "Sin pagador"}
            </span>
            <span className="flex items-center gap-3">
              <span className="mono text-[12px] text-ink-2">
                {formatDate(cobro.fecha)} · {formatCurrency(cobro.importeCents)}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirmar(cobro)}
                className="btn-ghost btn-sm"
              >
                Confirmar
              </button>
            </span>
          </li>
        ))}
      </ul>

      {restantes > visibles.length && (
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">
          Y {restantes - visibles.length} más.
        </p>
      )}
    </section>
  );
}
