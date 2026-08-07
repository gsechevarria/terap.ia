"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { acknowledgeFlaggedResponseAction } from "@/lib/actions/scale-responses";
import { formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { FlaggedResponse } from "@/lib/queries/scales";

/**
 * Alertas de ítem de riesgo pendientes de revisar, con acuse de recibo.
 *
 * El acuse es lo que convierte el contador en una señal útil: sin él, el banner
 * cuenta el histórico completo, no vuelve nunca a cero y se acaba ignorando.
 * Marcar "Visto" NO borra nada: solo registra quién la revisó y cuándo.
 */
export function FlaggedAlerts({
  patientId,
  responses,
}: {
  patientId: string;
  responses: FlaggedResponse[];
}) {
  const { run, pending, error } = useAction();
  if (responses.length === 0) return null;

  return (
    <div
      role="alert"
      className="mt-4 rounded-md border border-danger/25 bg-danger-soft p-3 text-sm text-danger"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {responses.length} respuesta{responses.length > 1 ? "s" : ""} con el
            ítem de riesgo marcado, sin revisar.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {responses.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-xs">
                  {r.scaleCode} · {formatDateTime(r.submittedAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Link
                    href={`/pro/patients/${patientId}/scales/${r.assignmentId}`}
                    className="text-xs font-medium underline underline-offset-2"
                  >
                    Ver
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        acknowledgeFlaggedResponseAction(r.id, patientId),
                      )
                    }
                    className="btn-subtle btn-sm text-danger hover:bg-danger/10 hover:text-danger"
                  >
                    Visto
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {error && <p className="mt-2 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}
