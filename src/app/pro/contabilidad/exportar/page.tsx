import Link from "next/link";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { DescargoFiscal } from "../_components/DescargoFiscal";

export default function ExportarPage() {
  // Ejercicios ofrecidos (fuera del JSX): año actual y dos anteriores.
  const y = new Date().getFullYear();
  const ejercicios = [y, y - 1, y - 2];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/pro/contabilidad" className="text-sm text-ink-3 hover:text-ink">
        ← Contabilidad
      </Link>
      <h1 className="page-title mt-3">Exportar</h1>
      <p className="mt-1 text-sm text-ink-2">
        Genera los libros registro y el resumen del periodo para tu gestor.
      </p>

      <DescargoFiscal className="mt-4" />

      <form method="get" action="/pro/contabilidad/export" className="card mt-5 p-4">
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

        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-5 space-y-2 text-sm text-ink-2">
        <p>
          <span className="font-medium text-ink">Excel</span> — tres hojas de
          libros registro (ingresos, gastos, bienes de inversión) + hoja resumen
          con la estimación del modelo 130, cuadradas para importar.
        </p>
        <p>
          <span className="font-medium text-ink">PDF</span> — resumen legible del
          periodo para ti.
        </p>
        <p>
          <span className="font-medium text-ink">CSV</span> — mismos libros con
          separador «;» para gestorías con software propio.
        </p>
      </div>
    </div>
  );
}
