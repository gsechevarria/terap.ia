"use client";

import { useState } from "react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { revisarProfesionalAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";

type Fila = {
  id: string;
  nombre: string | null;
  email: string | null;
  estado: "pending" | "approved" | "rejected" | "provisional";
  colegio: string | null;
  numeroColegiado: string | null;
  tipo: "solo" | "center" | null;
  nota: string | null;
  creado: string;
  /** Última consulta al registro del colegio, si la hubo. */
  evidencia: {
    veredicto: string | null;
    detalle: string;
    url: string | null;
    nombreRegistro: string | null;
  } | null;
};

const ESTADO: Record<string, { texto: string; tono: StatusTone }> = {
  pending: { texto: "Pendiente", tono: "info" },
  provisional: { texto: "Opera sin comprobar", tono: "warn" },
  rejected: { texto: "Rechazada", tono: "danger" },
  approved: { texto: "Aprobada", tono: "success" },
};

/**
 * Cola de acreditaciones.
 *
 * Aprobar concede el rol operativo; rechazar lo retira. Las dos cosas quedan
 * en `audit_log` con quién y cuándo. Rechazar EXIGE motivo: dejar a alguien
 * fuera sin decirle por qué no es una decisión, es un agujero.
 */
export function ColaAcreditaciones({ profesionales }: { profesionales: Fila[] }) {
  const { run, pending, error } = useAction();
  const [notas, setNotas] = useState<Record<string, string>>({});

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3">
      <h2 className="section-title">
        Acreditaciones{" "}
        <span className="font-normal text-ink-4">{profesionales.length}</span>
      </h2>
      {error && <p className="text-sm text-danger">{error}</p>}

      {profesionales.length === 0 ? (
        <p className="empty">No hay acreditaciones pendientes de revisar.</p>
      ) : (
        <ul className="border-t border-line">
          {profesionales.map((p) => {
            const e = ESTADO[p.estado];
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 py-4"
                style={{ borderBottom: "1px solid var(--line-soft)" }}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.nombre ?? "Sin nombre"}</p>
                    <p className="truncate text-sm text-ink-2">{p.email}</p>
                  </div>
                  {e && <Status tone={e.tono}>{e.texto}</Status>}
                </div>

                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <Dato t="Colegio" v={p.colegio ?? "—"} />
                  <Dato t="Nº colegiado" v={p.numeroColegiado ?? "—"} />
                  <Dato t="Tipo" v={p.tipo === "center" ? "Centro" : p.tipo === "solo" ? "Consulta individual" : "—"} />
                  <Dato t="Solicitud" v={formatDate(p.creado)} />
                </dl>

                {/* Lo que devolvió el registro del colegio: con esto se decide
                    sin tener que ir a buscarlo, y el enlace deja repetirlo. */}
                {p.evidencia && (
                  <p className="text-sm text-ink-2">
                    <span className="text-ink-3">Registro del colegio:</span>{" "}
                    {p.evidencia.detalle}
                    {p.evidencia.nombreRegistro &&
                      ` Allí figura como «${p.evidencia.nombreRegistro}».`}{" "}
                    {p.evidencia.url && (
                      <a
                        href={p.evidencia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent hover:underline"
                      >
                        Ver en el registro
                      </a>
                    )}
                  </p>
                )}

                {p.nota && (
                  <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-2">
                    Nota anterior: {p.nota}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <label className="field-label" htmlFor={`nota-${p.id}`}>
                    Motivo (obligatorio para rechazar)
                  </label>
                  <input
                    id={`nota-${p.id}`}
                    className="field text-sm"
                    value={notas[p.id] ?? ""}
                    onChange={(ev) => setNotas((n) => ({ ...n, [p.id]: ev.target.value }))}
                    placeholder="Colegiación comprobada en el registro del COP…"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => callAction(revisarProfesionalAction, p.id, "approved", notas[p.id]))
                    }
                    className="btn-primary"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => callAction(revisarProfesionalAction, p.id, "rejected", notas[p.id]))
                    }
                    className="btn-danger"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-3">{t}:</dt>
      <dd className="min-w-0 truncate">{v}</dd>
    </div>
  );
}
