"use client";

import { useState } from "react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { cambiarAccesoOrganizacionAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";

type Org = {
  id: string;
  nombre: string;
  tipo: "solo" | "center";
  estado: "pending" | "beta" | "suspended";
  concedido: string | null;
  caduca: string | null;
  nota: string | null;
};

const ESTADO: Record<string, { texto: string; tono: StatusTone }> = {
  pending: { texto: "Sin beta", tono: "neutral" },
  beta: { texto: "Beta autorizada", tono: "success" },
  suspended: { texto: "Suspendida", tono: "warn" },
};

/**
 * Acceso comercial por organización.
 *
 * NO ES UNA SUSCRIPCIÓN Y NO COBRA NADA: hoy el producto no tiene facturación.
 * `beta` es una autorización explícita con responsable y fecha; `suspended` es
 * una decisión manual que NO borra cuentas ni expedientes y NO corta el acceso
 * del paciente a sus propios datos. No hay suspensiones automáticas porque no
 * hay impago que detectar.
 */
export function AccesoComercial({ organizaciones }: { organizaciones: Org[] }) {
  const { run, pending, error } = useAction();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [hasta, setHasta] = useState<Record<string, string>>({});

  return (
    <section className="flex w-full flex-col gap-3 lg:w-[520px] lg:shrink-0">
      <h2 className="section-title">
        Acceso comercial{" "}
        <span className="font-normal text-ink-4">{organizaciones.length}</span>
      </h2>
      <p className="text-sm text-ink-2">
        Beta es una autorización, no una suscripción de pago. Suspender no borra
        nada ni bloquea el acceso del paciente.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}

      <ul className="divide-y divide-line-soft border-y border-line">
        {organizaciones.map((o) => {
          const e = ESTADO[o.estado];
          return (
            <li key={o.id} className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{o.nombre}</p>
                  <p className="text-xs text-ink-3">
                    {o.tipo === "center" ? "Centro" : "Consulta individual"}
                    {o.concedido && `, concedida el ${formatDate(o.concedido)}`}
                    {o.caduca && `, hasta ${formatDate(o.caduca)}`}
                  </p>
                </div>
                {e && <Status tone={e.tono}>{e.texto}</Status>}
              </div>

              {o.nota && <p className="text-xs text-ink-2">Nota: {o.nota}</p>}

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="field-label" htmlFor={`hasta-${o.id}`}>
                    Fin (opcional)
                  </label>
                  <input
                    id={`hasta-${o.id}`}
                    type="date"
                    className="field text-sm"
                    value={hasta[o.id] ?? ""}
                    onChange={(ev) => setHasta((h) => ({ ...h, [o.id]: ev.target.value }))}
                  />
                </div>
                <div className="min-w-40 flex-1">
                  <label className="field-label" htmlFor={`nota-org-${o.id}`}>
                    Nota
                  </label>
                  <input
                    id={`nota-org-${o.id}`}
                    className="field text-sm"
                    value={notas[o.id] ?? ""}
                    onChange={(ev) => setNotas((n) => ({ ...n, [o.id]: ev.target.value }))}
                  />
                </div>
                {o.estado !== "beta" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        callAction(
                          cambiarAccesoOrganizacionAction,
                          o.id,
                          "beta",
                          hasta[o.id] || undefined,
                          notas[o.id],
                        ),
                      )
                    }
                    className="btn-primary"
                  >
                    Conceder beta
                  </button>
                )}
                {o.estado !== "suspended" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        callAction(
                          cambiarAccesoOrganizacionAction,
                          o.id,
                          "suspended",
                          undefined,
                          notas[o.id],
                        ),
                      )
                    }
                    className="btn-danger"
                  >
                    Suspender
                  </button>
                )}
                {o.estado !== "pending" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        callAction(
                          cambiarAccesoOrganizacionAction,
                          o.id,
                          "pending",
                          undefined,
                          notas[o.id],
                        ),
                      )
                    }
                    className="btn-ghost"
                  >
                    Volver a sin beta
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
