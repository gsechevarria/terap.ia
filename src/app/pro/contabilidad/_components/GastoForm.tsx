"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createGastoAction } from "@/lib/actions/contabilidad";
import { CATEGORIAS_GASTO, CATEGORIA_LABEL } from "@/lib/fiscal";
import { formatEur } from "@/lib/format";

export function GastoForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [base, setBase] = useState("");
  const [tipoIva, setTipoIva] = useState("21");
  const [esBien, setEsBien] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const baseNum = Number(base.replace(",", ".")) || 0;
  const ivaNum = Number(tipoIva.replace(",", ".")) || 0;
  const cuota = Math.round(((baseNum * ivaNum) / 100) * 100) / 100;
  const total = Math.round((baseNum + cuota) * 100) / 100;

  async function submit(fd: FormData) {
    setError("");
    setPending(true);
    try {
      await createGastoAction(fd);
      formRef.current?.reset();
      setBase("");
      setTipoIva("21");
      setEsBien(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el gasto.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} action={submit} className="card bg-panel p-4">
      <h3 className="section-label">Nuevo gasto</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Fecha</span>
          <input type="date" name="fecha" required className="field" />
        </label>
        <label className="block">
          <span className="field-label">Categoría</span>
          <select name="categoria_deducible" defaultValue="otros" className="field">
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Proveedor</span>
          <input type="text" name="proveedor_nombre" className="field" placeholder="Nombre del proveedor" />
        </label>
        <label className="block">
          <span className="field-label">NIF del proveedor</span>
          <input type="text" name="proveedor_nif" className="field" placeholder="B12345678" />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">Concepto</span>
          <input type="text" name="concepto" className="field" placeholder="Descripción del gasto" />
        </label>
        <label className="block">
          <span className="field-label">Base (€)</span>
          <input
            type="number"
            name="base"
            min={0}
            step="0.01"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="field"
            required
          />
        </label>
        <label className="block">
          <span className="field-label">% IVA soportado</span>
          <input
            type="number"
            name="tipo_iva"
            min={0}
            max={100}
            step="1"
            value={tipoIva}
            onChange={(e) => setTipoIva(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">% afectación a la actividad</span>
          <input
            type="number"
            name="porcentaje_afectacion"
            min={0}
            max={100}
            step="1"
            defaultValue={100}
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">Justificante (opcional)</span>
          <input
            type="file"
            name="adjunto"
            accept="image/*,application/pdf"
            className="field py-1.5 text-xs"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="es_bien_inversion"
          checked={esBien}
          onChange={(e) => setEsBien(e.target.checked)}
        />
        Es un bien de inversión (se amortiza)
      </label>

      {esBien && (
        <div className="mt-2 grid gap-3 rounded-md border border-line bg-canvas p-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">% amortización anual</span>
            <input
              type="number"
              name="porcentaje_amortizacion"
              min={0}
              max={100}
              step="1"
              defaultValue={25}
              className="field"
            />
          </label>
          <label className="block">
            <span className="field-label">Años de amortización (opcional)</span>
            <input
              type="number"
              name="anios_amortizacion"
              min={1}
              step="1"
              className="field"
            />
          </label>
          <p className="text-xs text-ink-3 sm:col-span-2">
            El importe se amortiza en varios años en vez de deducirse íntegro; se
            listará en el libro de bienes de inversión.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Cuota IVA <span className="font-medium">{formatEur(cuota)}</span> · Total{" "}
          <span className="font-medium">{formatEur(total)}</span>
        </p>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando…" : "Añadir gasto"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </form>
  );
}
