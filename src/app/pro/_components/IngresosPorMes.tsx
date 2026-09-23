import Link from "next/link";
import { formatCurrency } from "@/lib/format";

export type MesDeIngresos = {
  /** 'YYYY-MM'. */
  mes: string;
  etiqueta: string;
  cents: number;
  esMesEnCurso: boolean;
  href: string;
};

/** Importe sin céntimos para la fila bajo las barras: «1.040 €». */
function importeCorto(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Cobrado por mes, con el mismo trazado que «Ocupación de tu agenda» de «Hoy»:
 * 150 px de alto fijo, eje abajo, techo y mitad a la izquierda, mes en curso
 * en `--green-2` y el resto en `--accent-solid`.
 *
 * Sustituye aquí a `BarChart`, que es un SVG escalado al ancho: en una hoja
 * ancha sus rótulos acababan a 22 px y las barras medían un palmo. Y a
 * diferencia de antes, los meses sin cobros SALEN, a cero: saltárselos ponía
 * julio al lado de septiembre como si agosto no hubiera existido.
 *
 * El importe va escrito bajo cada barra, así que el verde no es el único
 * portador del dato. Cada columna es un enlace al histórico de ese mes.
 */
export function IngresosPorMes({ meses }: { meses: MesDeIngresos[] }) {
  const maximo = Math.max(...meses.map((m) => m.cents), 1);
  const paso = maximo > 500_000 ? 100_000 : maximo > 100_000 ? 50_000 : 10_000;
  const techo = Math.ceil(maximo / paso) * paso;

  return (
    <div role="group" aria-label="Cobrado por mes">
      <div
        className="relative flex h-[150px] items-end gap-1.5 pl-14 sm:gap-2.5"
        style={{ borderBottom: "1px solid var(--line-strong)" }}
      >
        <span className="absolute top-[-8px] left-0 text-[11.5px] text-ink-3">
          {importeCorto(techo)}
        </span>
        <span className="absolute top-[63px] left-0 text-[11.5px] text-ink-4">
          {importeCorto(techo / 2)}
        </span>
        {meses.map((m) => (
          <Link
            key={m.mes}
            href={m.href}
            aria-label={`${m.etiqueta}: ${formatCurrency(m.cents)} cobrados`}
            title={`${m.etiqueta}: ${formatCurrency(m.cents)}`}
            className="flex h-full flex-1 items-end rounded-t-sm transition-colors hover:bg-surface-subtle"
          >
            <span
              className="block w-full rounded-t-sm"
              style={{
                height: `${Math.max(m.cents > 0 ? 2 : 0, Math.round((m.cents / techo) * 100))}%`,
                background: m.esMesEnCurso ? "var(--green-2)" : "var(--accent-solid)",
              }}
            />
          </Link>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-1.5 pl-14 sm:gap-2.5">
        {meses.map((m) => (
          <span key={m.mes} className="min-w-0 flex-1 text-center text-[11px] leading-tight">
            <span className="block text-ink-4">{m.etiqueta}</span>
            <span className={`block truncate ${m.cents > 0 ? "text-ink-2" : "text-ink-4"}`}>
              {m.cents > 0 ? importeCorto(m.cents) : "0 €"}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-3">
        <span aria-hidden className="h-2.5 w-3.5 rounded-xs" style={{ background: "var(--green-2)" }} />
        Mes en curso, todavía abierto.
      </p>
    </div>
  );
}
