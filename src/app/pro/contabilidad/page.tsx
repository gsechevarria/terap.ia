import Link from "next/link";
import { Plus, Download, Settings, TriangleAlert, CalendarClock } from "lucide-react";
import { getFiscalArrays } from "@/lib/queries/contabilidad";
import { formatEur } from "@/lib/format";
import {
  calcularResumenAnual,
  getParams,
  hayParamsExactos,
  trimestreActual,
  proximoVencimiento,
  alertasVencimiento,
} from "@/lib/fiscal";
import { DescargoFiscal } from "./_components/DescargoFiscal";

function fmtYMD(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function ContabilidadPage() {
  // "Hoy" fuera del JSX (regla de pureza de React).
  const ref = new Date();
  const { trimestre, anio } = trimestreActual(ref);
  const params = getParams(anio);

  const data = await getFiscalArrays(anio);
  const resumen = calcularResumenAnual(data, anio, params);
  const q = resumen.trimestres[trimestre - 1];
  const prox = proximoVencimiento(ref, params);
  const alertas = alertasVencimiento(ref, params, 45);
  const sinDatos = data.ingresos.length === 0 && data.gastos.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Contabilidad</h1>
          <p className="mt-1 text-sm text-ink-2">
            Resumen fiscal orientativo · Ejercicio {anio}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/pro/contabilidad/gastos" className="btn-primary">
            <Plus className="size-4" aria-hidden /> Registrar gasto
          </Link>
          <Link href="/pro/contabilidad/exportar" className="btn-ghost">
            <Download className="size-4" aria-hidden /> Exportar
          </Link>
          <Link href="/pro/contabilidad/configuracion" className="btn-ghost">
            <Settings className="size-4" aria-hidden /> Configuración
          </Link>
        </div>
      </div>

      <DescargoFiscal className="mt-4" />

      {!hayParamsExactos(anio) && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warn-soft bg-warn-soft px-3 py-2 text-xs text-warn">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          No hay parámetros fiscales confirmados para {anio}; se usan los del
          último ejercicio disponible. Verifica las cifras con tu asesor.
        </p>
      )}

      {alertas.length > 0 && (
        <div className="mt-3 rounded-lg border border-warn-soft bg-warn-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warn">
            <CalendarClock className="size-4" aria-hidden /> Vencimientos próximos
          </p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-ink-2">
            {alertas.map((a) => (
              <li key={`${a.modelo}-${a.ejercicio}-${a.trimestre ?? "r"}`}>
                {a.etiqueta} — {fmtYMD(a.fechaLimiteYMD)}{" "}
                <span className="text-ink-3">
                  ({a.diasRestantes === 0 ? "hoy" : `en ${a.diasRestantes} días`})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Estimación del trimestre actual */}
      <section className="card mt-6 p-5">
        <div className="section-label">
          Pago fraccionado estimado · Modelo 130 · {trimestre}T {anio}
        </div>
        <div className="mt-1 text-4xl font-semibold tracking-[-0.02em]">
          {formatEur(q.pagoTrimestre)}
        </div>
        <p className="mt-1 text-xs text-ink-3">
          Estimación acumulada del 1 ene al fin del {trimestre}T. Orientativa.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Dato label="Ingresos acum." value={formatEur(q.ingresosAcumulados)} />
          <Dato label="Gastos deducibles" value={formatEur(q.gastosDeduciblesAcumulados)} />
          <Dato label="Rendimiento neto" value={formatEur(q.rendimientoNeto)} />
          <Dato label="Retenciones" value={formatEur(q.retencionesAcumuladas)} />
        </dl>
      </section>

      {/* Ingresos vs gastos + próximo vencimiento */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Tile label="Ingresos del año" value={formatEur(resumen.ingresosTotales)} />
        <Tile
          label="Gastos deducibles"
          value={formatEur(resumen.gastosDeduciblesTotales)}
          hint={`${formatEur(resumen.amortizacionesTotales)} en amortizaciones`}
        />
        <Tile
          label="Rendimiento neto (año)"
          value={formatEur(resumen.rendimientoNeto)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <div className="section-label mb-2">Próximo vencimiento</div>
          {prox ? (
            <div>
              <p className="text-sm font-medium">{prox.etiqueta}</p>
              <p className="mt-0.5 text-sm text-ink-2">
                {fmtYMD(prox.fechaLimiteYMD)} ·{" "}
                {prox.diasRestantes === 0
                  ? "vence hoy"
                  : `en ${prox.diasRestantes} días`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-2">Sin vencimientos próximos.</p>
          )}
        </section>

        <section className="card p-4">
          <div className="section-label mb-2">Pagos fraccionados del año</div>
          <ul className="space-y-1 text-sm">
            {resumen.trimestres.map((t) => (
              <li
                key={t.trimestre}
                className={`flex justify-between ${
                  t.trimestre === trimestre ? "font-medium" : "text-ink-2"
                }`}
              >
                <span>{t.trimestre}T</span>
                <span className="tabular-nums">{formatEur(t.pagoTrimestre)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {sinDatos && (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-2">
          Aún no hay datos de este ejercicio. Empieza por{" "}
          <Link href="/pro/contabilidad/configuracion" className="text-accent hover:underline">
            configurar tu perfil fiscal
          </Link>{" "}
          y{" "}
          <Link href="/pro/contabilidad/gastos" className="text-accent hover:underline">
            registrar tus gastos
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tracking-[-0.01em] tabular-nums">
        {value}
      </div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}
