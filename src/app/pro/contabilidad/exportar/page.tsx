import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { DescargoFiscal } from "../_components/DescargoFiscal";
import { NavContabilidad } from "@/app/pro/contabilidad/_components/NavContabilidad";

export default function ExportarPage() {
  // Ejercicios ofrecidos (fuera del JSX): año actual y dos anteriores.
  const y = new Date().getFullYear();
  const ejercicios = [y, y - 1, y - 2];

  return (
    <div>
      <h1 className="page-title">Exportar</h1>
      <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">
        Genera los libros registro y el resumen del periodo para tu gestor.
      </p>

      <div className="mt-[22px]">
        <NavContabilidad ejercicio={y} />
      </div>

      <DescargoFiscal className="mt-[22px]" />

      <form method="get" action="/pro/contabilidad/export" className="mt-7 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Ejercicio</span>
            <select name="ejercicio" defaultValue={y} className="field">
              {ejercicios.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Periodo</span>
            <select name="periodo" defaultValue="anual" className="field">
              <option value="anual">Año completo</option>
              <option value="1">1.º trimestre</option>
              <option value="2">2.º trimestre</option>
              <option value="3">3.º trimestre</option>
              <option value="4">4.º trimestre</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            name="formato"
            value="xlsx"
            className="btn-primary"
          >
            <FileSpreadsheet className="size-4" aria-hidden /> Excel (libros registro)
          </button>
          <button type="submit" name="formato" value="pdf" className="btn-ghost">
            <FileText className="size-4" aria-hidden /> PDF (resumen)
          </button>
          <button type="submit" name="formato" value="csv" className="btn-ghost">
            <FileDown className="size-4" aria-hidden /> CSV
          </button>
        </div>
      </form>

      <section className="mt-7 border-t border-line pt-6">
        <h2 className="section-title">Qué lleva cada formato</h2>
        <dl className="mt-3 text-[13.5px] text-ink-2">
          <div className="border-b border-line-soft py-2.5">
            <dt className="font-medium text-ink">Excel</dt>
            <dd className="mt-0.5">
              Tres hojas de libros registro (ingresos, gastos, bienes de
              inversión) más la hoja resumen con la estimación del modelo 130,
              cuadradas para importar.
            </dd>
          </div>
          <div className="border-b border-line-soft py-2.5">
            <dt className="font-medium text-ink">PDF</dt>
            <dd className="mt-0.5">Resumen legible del periodo para ti.</dd>
          </div>
          <div className="py-2.5">
            <dt className="font-medium text-ink">CSV</dt>
            <dd className="mt-0.5">
              Mismos libros con separador «;» para gestorías con software propio.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
