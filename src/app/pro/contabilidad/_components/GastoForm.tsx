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
    <form key={revision} aria-busy={pending} className="card p-5" onSubmit={event => {
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
      {pending && <p role="status" className="mt-2 text-[13px] text-ink-2">Guardando…</p>}
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
      <h3 className="section-title">Nuevo gasto</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          {/* El campo no baja de 16 px: por debajo, iOS hace zoom al enfocar. */}
          <input
            type="file"
            name="adjunto"
            accept="image/*,application/pdf"
            className="field"
          />
        </label>
      </div>

      <label className="mt-5 flex items-center gap-2.5 border-t border-line pt-5 text-[13.5px] text-ink">
        <input
          type="checkbox"
          name="es_bien_inversion"
          checked={esBien}
          onChange={(e) => setEsBien(e.target.checked)}
          className="size-4 shrink-0 accent-[var(--accent)]"
        />
        Es un bien de inversión (se amortiza)
      </label>

      {esBien && (
        <div className="tinted mt-3 grid gap-4 p-4 sm:grid-cols-2">
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
          <p className="text-[12px] text-ink-2 sm:col-span-2">
            El importe se amortiza en varios años en vez de deducirse íntegro; se
            listará en el libro de bienes de inversión.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
        <div className="flex gap-7">
          <div>
            <div className="text-[12.5px] text-ink-3">Cuota de IVA</div>
            <div className="mono mt-0.5 text-[15px] font-medium text-ink">
              {formatEur(cuota)}
            </div>
          </div>
          <div>
            <div className="text-[12.5px] text-ink-3">Total</div>
            <div className="mono mt-0.5 text-[15px] font-medium text-ink">
              {formatEur(total)}
            </div>
          </div>
        </div>
        <SubmitButton pendingLabel="Guardando…">Añadir gasto</SubmitButton>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-[12.5px] text-danger-ink">
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
