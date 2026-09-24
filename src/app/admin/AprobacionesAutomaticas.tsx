"use client";

import { useState } from "react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { revisarProfesionalAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/format";

export type AprobacionAutomatica = {
  id: string;
  nombre: string | null;
  email: string | null;
  colegio: string | null;
  numero: string | null;
  aprobada: string | null;
  /** URL exacta de la consulta al registro, para repetirla a mano. */
  url: string | null;
  /** Nombre tal como figura en el registro del colegio. */
  nombreRegistro: string | null;
};

/**
 * Altas aprobadas solas por el registro del colegio.
 *
 * Es la red de la decisión del 24-sep: la aprobación es automática, pero el
 * registro prueba que el colegiado existe, no que quien se registró sea él.
 * Aquí se ven, con la consulta que las aprobó, y se revocan de un clic con
 * motivo. Revocar es rechazar: retira el rol operativo al momento.
 */
export function AprobacionesAutomaticas({ filas }: { filas: AprobacionAutomatica[] }) {
  const { run, pending, error } = useAction();
  const [notas, setNotas] = useState<Record<string, string>>({});

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">
        Aprobadas por el registro{" "}
        <span className="font-normal text-ink-4">{filas.length} recientes</span>
      </h2>
      <p className="text-[13px] text-ink-3">
        El registro del colegio confirmó número, nombre y situación. No confirma
        que quien se registró sea esa persona: si algo no cuadra, revócala.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}

      {filas.length === 0 ? (
        <p className="border-t border-line py-3 text-[13.5px] text-ink-3">
          Todavía no se ha aprobado ninguna alta por el registro.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft border-y border-line">
          {filas.map((f) => (
            <li key={f.id} className="flex flex-col gap-2.5 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="font-medium">{f.nombre ?? "Sin nombre"}</p>
                  <p className="truncate text-[12.5px] text-ink-3">
                    {f.email}
                    {f.aprobada && `, aprobada el ${formatDate(f.aprobada)}`}
                  </p>
                </div>
                <p className="text-[12.5px] text-ink-2">
                  {f.colegio ?? "Colegio"}, {f.numero ?? "sin número"}
                  {f.url && (
                    <>
                      {" "}
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent hover:underline"
                      >
                        Ver en el registro
                      </a>
                    </>
                  )}
                </p>
              </div>
              {f.nombreRegistro && (
                <p className="text-[12.5px] text-ink-3">
                  En el registro figura como «{f.nombreRegistro}».
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <input
                  aria-label={`Motivo para revocar a ${f.nombre ?? "este profesional"}`}
                  className="field min-w-48 flex-1 text-sm"
                  value={notas[f.id] ?? ""}
                  onChange={(ev) => setNotas((n) => ({ ...n, [f.id]: ev.target.value }))}
                  placeholder="Motivo (obligatorio para revocar)"
                />
                <button
                  type="button"
                  disabled={pending || !(notas[f.id] ?? "").trim()}
                  onClick={() =>
                    run(() => callAction(revisarProfesionalAction, f.id, "rejected", notas[f.id]))
                  }
                  className="btn-danger"
                >
                  Revocar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
