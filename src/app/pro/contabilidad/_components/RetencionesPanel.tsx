"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { borrarRetencionAction, guardarRetencionAction } from "@/lib/actions/retenciones";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Retencion } from "@/lib/queries/expediente";
import type { Enums } from "@/lib/database.types";

/**
 * Las cuatro clases no se mezclan nunca en un mismo saldo.
 *
 * Una retención que le practicaron al profesional y otra que practicó él son
 * cosas opuestas —una es dinero suyo adelantado a Hacienda, la otra una deuda
 * con Hacienda—, y sumarlas produce un número sin significado.
 */
const CLASES: { valor: Enums<"clase_retencion">; etiqueta: string; ayuda: string }[] = [
  {
    valor: "soportada_cliente",
    etiqueta: "Retención que me practicaron",
    ayuda: "Pago a cuenta de su IRPF. No reduce los ingresos de la actividad.",
  },
  {
    valor: "practicada_colaborador",
    etiqueta: "Retención que practiqué a un tercero",
    ayuda: "Deuda con Hacienda que se declara en el 111 o el 115.",
  },
  { valor: "pago_fraccionado_irpf", etiqueta: "Pago fraccionado (modelo 130)", ayuda: "" },
  { valor: "liquidacion_iva", etiqueta: "Liquidación de IVA (modelo 303)", ayuda: "" },
];

const PERIODOS = ["1T", "2T", "3T", "4T", "anual"];

export function RetencionesPanel({
  ejercicio,
  retenciones,
}: {
  ejercicio: number;
  retenciones: Retencion[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();

  const [clase, setClase] = useState<Enums<"clase_retencion">>("soportada_cliente");
  const [periodo, setPeriodo] = useState("");
  const [modelo, setModelo] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");

  const claseActual = CLASES.find((c) => c.valor === clase);

  function guardar() {
    run(async () => {
      await callAction(guardarRetencionAction, {
        ejercicio,
        clase,
        periodo,
        modelo,
        importeEuros: importe === "" ? NaN : Number(importe),
        fecha: fecha || null,
        notas,
      });
      setImporte("");
      setNotas("");
      router.refresh();
    });
  }

  const porClase = CLASES.map((c) => ({
    ...c,
    filas: retenciones.filter((r) => r.clase === c.valor),
  })).filter((c) => c.filas.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6">
        <h2 className="card-title">Registrar retención o pago a cuenta</h2>
        <p className="mt-1.5 text-body-sm text-ink-2">
          Se registran por separado porque son cosas distintas. Conciliarlas con
          las facturas y los certificados es cosa del gestor: la aplicación no da
          por practicada una retención solo porque aparezca en una factura.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="field-label">Clase</span>
            <select
              value={clase}
              onChange={(e) => setClase(e.target.value as Enums<"clase_retencion">)}
              className="field"
            >
              {CLASES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
            {claseActual?.ayuda && (
              <span className="mt-1.5 block text-[11px] text-ink-3">{claseActual.ayuda}</span>
            )}
          </label>

          <label className="block">
            <span className="field-label">Importe (€)</span>
            <input
              type="number"
              step="0.01"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0,00"
              className="field"
            />
          </label>

          <label className="block">
            <span className="field-label">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="field"
            />
          </label>

          <label className="block">
            <span className="field-label">Periodo</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="field">
              <option value="">Sin especificar</option>
              {PERIODOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">Modelo</span>
            <input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="130, 303, 111…"
              className="field"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="field-label">Notas</span>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Pagador, referencia del certificado…"
              className="field"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={pending || importe === ""}
          onClick={guardar}
          className="btn-primary mt-5"
        >
          {pending ? "Guardando…" : "Registrar"}
        </button>
      </section>

      {porClase.map((c) => (
        <section key={c.valor} className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h3 className="card-title">{c.etiqueta}</h3>
            <p className="mono mt-0.5 text-[13px] text-ink-2">
              {formatCurrency(c.filas.reduce((s, r) => s + r.importe_cents, 0))} en{" "}
              {c.filas.length} {c.filas.length === 1 ? "registro" : "registros"}
            </p>
          </div>
          <ul className="divide-y divide-line">
            {c.filas.map((r) => (
              <li key={r.id} className="group flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0 text-[13px]">
                  {r.modelo && <span className="mono mr-2 text-ink-2">{r.modelo}</span>}
                  {r.periodo && <span className="chip mr-2">{r.periodo}</span>}
                  {r.notas ?? (r.fecha ? formatDate(r.fecha) : "Sin detalle")}
                </span>
                <span className="flex items-center gap-3">
                  <span className="mono text-[13px] font-medium">
                    {formatCurrency(r.importe_cents)}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label="Eliminar registro"
                    onClick={() =>
                      run(async () => {
                        await callAction(borrarRetencionAction, r.id, ejercicio);
                        router.refresh();
                      })
                    }
                    className="btn-danger btn-sm opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
