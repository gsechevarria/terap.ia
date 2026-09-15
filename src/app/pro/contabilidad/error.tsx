"use client";
import Link from "next/link";

/**
 * El resumen no se calcula mientras queden registros sin tratamiento fiscal
 * confirmado, que es lo habitual con históricos anteriores a esa columna.
 *
 * La versión anterior remitía a "los cobros en la ficha de cada paciente", y
 * ese control se retiró de la tabla de pagos: la pantalla pedía hacer algo que
 * ya no se podía hacer en ningún sitio. Ahora lleva a la revisión, que dice
 * cuántos registros faltan, cuáles, y permite confirmarlos.
 */
export default function FiscalError({ reset }: { reset: () => void }) {
  return (
    <div className="card p-6" role="alert">
      <h2 className="card-title">No se ha podido calcular el resumen</h2>
      <p className="mt-2 text-body-sm text-ink-2">
        Lo más probable es que queden registros pendientes de confirmación
        fiscal: cobros sin tratamiento, gastos sin IVA recuperable o bienes de
        inversión sin revisar. La revisión le dice cuántos son y cuáles. Si no
        hay ninguno, compruebe su conexión y reintente.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/pro/contabilidad/revision" className="btn-primary">
          Ver qué falta por revisar
        </Link>
        <Link href="/pro/contabilidad/gastos" className="btn-ghost">
          Ir a gastos
        </Link>
        <button onClick={reset} className="btn-subtle">
          Reintentar
        </button>
      </div>
    </div>
  );
}
