"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import {
  updateGastoAction,
  deleteGastoAction,
} from "@/lib/actions/contabilidad";
import {
  CATEGORIAS_GASTO,
  CATEGORIA_LABEL,
  type CategoriaGasto,
  type SituacionIva,
} from "@/lib/fiscal";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Gasto } from "@/lib/types";

function deducibleCents(g: Gasto, situacionIva: SituacionIva): number {
  const coste = situacionIva === "sujeta" ? g.base_cents : g.base_cents + g.cuota_iva_cents;
  return Math.round((coste * g.porcentaje_afectacion) / 100);
}

export function GastosTable({
  gastos,
  situacionIva,
}: {
  gastos: Gasto[];
  situacionIva: SituacionIva;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  async function saveEdit(fd: FormData) {
    await updateGastoAction(fd);
    setEditingId(null);
    router.refresh();
  }

  if (gastos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-2">
        No hay gastos registrados todavía.
      </p>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Proveedor</th>
            <th className="text-right">Base</th>
            <th className="text-right">Total</th>
            <th className="text-right">Deducible</th>
            <th className="w-0" />
          </tr>
        </thead>
        <tbody>
          {gastos.map((g) =>
            editingId === g.id ? (
              <tr key={g.id}>
                <td colSpan={7} className="bg-panel">
                  <form action={saveEdit} className="grid gap-3 p-3 sm:grid-cols-3">
                    <input type="hidden" name="id" value={g.id} />
                    <label className="block">
                      <span className="field-label">Fecha</span>
                      <input type="date" name="fecha" defaultValue={g.fecha} required className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Categoría</span>
                      <select
                        name="categoria_deducible"
                        defaultValue={g.categoria_deducible as CategoriaGasto}
                        className="field"
                      >
                        {CATEGORIAS_GASTO.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORIA_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label">Concepto</span>
                      <input type="text" name="concepto" defaultValue={g.concepto ?? ""} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Proveedor</span>
                      <input type="text" name="proveedor_nombre" defaultValue={g.proveedor_nombre ?? ""} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">NIF</span>
                      <input type="text" name="proveedor_nif" defaultValue={g.proveedor_nif ?? ""} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Base (€)</span>
                      <input type="number" name="base" min={0} step="0.01" defaultValue={(g.base_cents / 100).toFixed(2)} className="field" required />
                    </label>
                    <label className="block">
                      <span className="field-label">% IVA</span>
                      <input type="number" name="tipo_iva" min={0} max={100} step="1" defaultValue={g.tipo_iva} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">% afectación</span>
                      <input type="number" name="porcentaje_afectacion" min={0} max={100} step="1" defaultValue={g.porcentaje_afectacion} className="field" />
                    </label>
                    <label className="block">
                      <span className="field-label">Reemplazar justificante</span>
                      <input type="file" name="adjunto" accept="image/*,application/pdf" className="field py-1.5 text-xs" />
                    </label>
                    <div className="flex items-end gap-2 sm:col-span-3">
                      <button type="submit" className="btn-primary btn-sm">
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn-subtle btn-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={g.id} className="group row-hover last:[&>td]:border-b-0">
                <td className="whitespace-nowrap">{formatDate(g.fecha)}</td>
                <td>
                  {CATEGORIA_LABEL[g.categoria_deducible as CategoriaGasto] ??
                    g.categoria_deducible}
                  {g.es_bien_inversion && (
                    <span className="chip ml-1.5">bien inversión</span>
                  )}
                </td>
                <td className="text-ink-2">{g.proveedor_nombre ?? "—"}</td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(g.base_cents)}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(g.total_cents)}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(deducibleCents(g, situacionIva))}
                </td>
                <td className="whitespace-nowrap text-right">
                  <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {g.adjunto_path && (
                      <a
                        href={`/receipts?path=${encodeURIComponent(g.adjunto_path)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-subtle btn-sm"
                        title="Ver justificante"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingId(g.id)}
                      className="btn-subtle btn-sm"
                    >
                      Editar
                    </button>
                    <form action={deleteGastoAction.bind(null, g.id)}>
                      <button type="submit" className="btn-danger btn-sm">
                        Eliminar
                      </button>
                    </form>
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
