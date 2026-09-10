"use client";
import Link from "next/link";
export default function FiscalError({ reset }: { reset: () => void }) {
  return <div className="card p-6" role="alert">
    <h2 className="text-lg font-semibold">No se ha podido calcular el resumen</h2>
    <p className="mt-3 text-sm">Comprueba tu conexión y revisa los registros pendientes de confirmación fiscal: el IVA y las retenciones de los cobros en la ficha de cada paciente, y el IVA recuperable de los gastos históricos.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Link href="/pro/pagos" className="btn-subtle">Revisar cobros</Link>
      <Link href="/pro/contabilidad/gastos" className="btn-subtle">Revisar gastos</Link>
      <button onClick={reset} className="btn-primary">Reintentar</button>
    </div>
  </div>;
}
