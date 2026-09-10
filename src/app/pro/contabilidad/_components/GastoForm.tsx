"use client";
import { callAction } from "@/lib/action-result";

import { uploadFormFile } from "@/lib/upload-client";

import { useRef, useState, useTransition } from "react";
import { createGastoAction } from "@/lib/actions/contabilidad";
import { CATEGORIAS_GASTO, CATEGORIA_LABEL } from "@/lib/fiscal";
import { actionErrorMessage } from "@/lib/errors";
import { formatEur } from "@/lib/format";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Valores iniciales del formulario. Un fallo conserva el DOM y su input file. */
type GastoValues = {
  fecha: string;
  categoria_deducible: string;
  proveedor_nombre: string;
  proveedor_nif: string;
  concepto: string;
  base: string;
  tipo_iva: string;
  porcentaje_afectacion: string;
  es_bien_inversion: boolean;
  porcentaje_amortizacion: string;
  anios_amortizacion: string;
  /** El adjunto NO se puede repoblar: el navegador prohíbe fijar un input file. */
  hadFile: boolean;
};

/** El formulario solo se reinicia tras confirmar el guardado, incluido el archivo. */
export function GastoForm() {
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  return (
    <form key={revision} aria-busy={pending} className="card bg-panel p-4" onSubmit={event => {
      event.preventDefault();
      if (sending.current) return;
      const fd = new FormData(event.currentTarget);
      sending.current = true; setError("");
      startTransition(async () => {
        try {
          await uploadFormFile(fd, "adjunto", "receipts");
          await callAction(createGastoAction, fd);
          setRevision(value => value + 1);
        } catch (e) { setError(actionErrorMessage(e)); }
        finally { sending.current = false; }
      });
    }}>
      <fieldset disabled={pending} className="contents"><GastoFields error={error} /></fieldset>
      {pending && <p role="status" className="mt-2 text-sm">Guardando…</p>}
    </form>
  );
}

function GastoFields({
  values: v,
  error,
}: {
  values?: GastoValues;
  error?: string;
}) {
  // Controlados solo los tres que alimentan el total en vivo.
  const [base, setBase] = useState(v?.base ?? "");
  const [tipoIva, setTipoIva] = useState(v?.tipo_iva ?? "21");
  const [esBien, setEsBien] = useState(v?.es_bien_inversion ?? false);

  const baseNum = Number(base.replace(",", ".")) || 0;
  const ivaNum = Number(tipoIva.replace(",", ".")) || 0;
  const cuota = Math.round(((baseNum * ivaNum) / 100) * 100) / 100;
  const total = Math.round((baseNum + cuota) * 100) / 100;

  return (
    <>
      <h3 className="section-label">Nuevo gasto</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Fecha</span>
          <input
            type="date"
            name="fecha"
            required
            defaultValue={v?.fecha}
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">Categoría</span>
          <select
            name="categoria_deducible"
            defaultValue={v?.categoria_deducible ?? "otros"}
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
          <span className="field-label">Proveedor</span>
          <input
            type="text"
            name="proveedor_nombre"
            defaultValue={v?.proveedor_nombre}
            className="field"
            placeholder="Nombre del proveedor"
          />
        </label>
        <label className="block">
          <span className="field-label">NIF del proveedor</span>
          <input
            type="text"
            name="proveedor_nif"
            defaultValue={v?.proveedor_nif}
            className="field"
            placeholder="B12345678"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">Concepto</span>
          <input
            type="text"
            name="concepto"
            defaultValue={v?.concepto}
            className="field"
            placeholder="Descripción del gasto"
          />
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
            defaultValue={v?.porcentaje_afectacion ?? 100}
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
              defaultValue={v?.porcentaje_amortizacion ?? 25}
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
              defaultValue={v?.anios_amortizacion}
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
        <SubmitButton pendingLabel="Guardando…">Añadir gasto</SubmitButton>
      </div>

      {error && (
        <div className="mt-2 rounded bg-danger-soft p-2.5 text-xs text-danger">
          <p>{error}</p>
          {v?.hadFile && (
            <p className="mt-1">
              Vuelve a seleccionar el justificante: por seguridad, el navegador
              no permite recuperar el archivo automáticamente.
            </p>
          )}
        </div>
      )}
    </>
  );
}
