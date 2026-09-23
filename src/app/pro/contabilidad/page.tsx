import Link from "next/link";
import { Plus, Download, Settings, TriangleAlert, CalendarClock, ListChecks, FolderOpen } from "lucide-react";
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

  // Lo apartado por falta de confirmación fiscal. Se cuenta y se dice; antes
  // un solo registro sin confirmar tiraba la sección entera y el profesional
  // no veía ni lo que había cobrado.
  const totalExcluidos =
    data.excluidos.ingresos + data.excluidos.gastos + data.excluidos.bienes;
  const detalleExcluidos = [
    data.excluidos.ingresos > 0 ? `${data.excluidos.ingresos} de cobros` : null,
    data.excluidos.gastos > 0 ? `${data.excluidos.gastos} de gastos` : null,
    data.excluidos.bienes > 0 ? `${data.excluidos.bienes} de bienes` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const resumen = calcularResumenAnual(data, anio, params);
  // `calcularResumenAnual` produce siempre los cuatro trimestres, pero el
  // acceso indexado no lo sabe.
  const q = resumen.trimestres[trimestre - 1] ?? resumen.trimestres[0]!;
  const prox = proximoVencimiento(ref, params);
  const alertas = alertasVencimiento(ref, params, 45);
  const sinDatos = data.ingresos.length === 0 && data.gastos.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="page-title">Contabilidad</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            Resumen fiscal orientativo del ejercicio {anio}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/pro/contabilidad/gastos" className="btn-primary">
            <Plus size={16} strokeWidth={1.75} aria-hidden /> Registrar gasto
          </Link>
          <Link href="/pro/contabilidad/exportar" className="btn-ghost">
            <Download size={16} strokeWidth={1.75} aria-hidden /> Exportar
          </Link>
          <Link href={`/pro/contabilidad/expediente/${anio}`} className="btn-ghost">
            <FolderOpen size={16} strokeWidth={1.75} aria-hidden /> Expediente anual
          </Link>
          <Link href="/pro/contabilidad/revision" className="btn-ghost">
            <ListChecks size={16} strokeWidth={1.75} aria-hidden /> Revisión
          </Link>
          <Link href="/pro/contabilidad/configuracion" className="btn-ghost">
            <Settings size={16} strokeWidth={1.75} aria-hidden /> Configuración
          </Link>
        </div>
      </div>

      <DescargoFiscal className="mt-5" />

      {totalExcluidos > 0 && (
        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-[13px] text-ink">
          <TriangleAlert
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="mt-0.5 shrink-0 text-warning-ink"
          />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              Las cifras de abajo no incluyen {totalExcluidos}{" "}
              {totalExcluidos === 1 ? "registro" : "registros"} sin tratamiento
              fiscal confirmado
            </span>
            {detalleExcluidos && <> ({detalleExcluidos})</>}. Se muestra lo
            cobrado y lo confirmado; lo demás queda apartado hasta que lo revise,
            no descartado.
          </p>
          <Link href="/pro/contabilidad/revision" className="btn-ghost btn-sm shrink-0">
            Revisar
          </Link>
        </div>
      )}

      {!hayParamsExactos(anio) && (
        <p className="mt-3 flex items-start gap-2.5 rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-[13px] text-ink">
          <TriangleAlert
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="mt-0.5 shrink-0 text-warning-ink"
          />
          <span>
            No hay parámetros fiscales confirmados para {anio}; se usan los del
            último ejercicio disponible. Verifica las cifras con tu asesor.
          </span>
        </p>
      )}

      {alertas.length > 0 && (
        <div className="mt-3 rounded-md border border-warning-line bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <CalendarClock
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className="text-warning-ink"
            />
            Vencimientos próximos
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
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

      {/* La cifra que se viene a ver, sin caja alrededor: la jerarquía la hace
          su tamaño, no un borde. */}
      <section className="mt-8">
        <p className="section-label">
          Pago fraccionado estimado del {trimestre}T {anio}, modelo 130
        </p>
        <p className="figure mono mt-1.5">{formatEur(q.pagoTrimestre)}</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Estimación acumulada del 1 ene al fin del {trimestre}T. Orientativa.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-7 gap-y-4 sm:grid-cols-4">
          <Dato label="Ingresos acumulados" value={formatEur(q.ingresosAcumulados)} />
          <Dato label="Gastos deducibles" value={formatEur(q.gastosDeduciblesAcumulados)} />
          <Dato label="Rendimiento neto" value={formatEur(q.rendimientoNeto)} />
          <Dato label="Retenciones" value={formatEur(q.retencionesAcumuladas)} />
        </dl>
      </section>

      {/* Tres cifras del año, no tres tarjetas iguales en mosaico. */}
      <section className="mt-7 border-t border-line pt-6">
        <h2 className="section-title">Resumen del ejercicio</h2>
        <div className="mt-4 grid gap-x-7 gap-y-5 sm:grid-cols-3">
          <Cifra label="Ingresos del año" value={formatEur(resumen.ingresosTotales)} />
          <Cifra
            label="Gastos deducibles"
            value={formatEur(resumen.gastosDeduciblesTotales)}
            hint={`${formatEur(resumen.amortizacionesTotales)} en amortizaciones`}
          />
          <Cifra
            label="Rendimiento neto del año"
            value={formatEur(resumen.rendimientoNeto)}
          />
        </div>
      </section>

      <div className="mt-7 grid gap-x-10 gap-y-7 border-t border-line pt-6 md:grid-cols-2">
        <section>
          <h2 className="section-title">Próximo vencimiento</h2>
          {prox ? (
            <div className="mt-2">
              <p className="text-[13.5px] font-medium text-ink">{prox.etiqueta}</p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {fmtYMD(prox.fechaLimiteYMD)},{" "}
                {prox.diasRestantes === 0
                  ? "vence hoy"
                  : `en ${prox.diasRestantes} días`}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-ink-2">Sin vencimientos próximos.</p>
          )}
        </section>

        <section>
          <h2 className="section-title">Pagos fraccionados del año</h2>
          <ul className="mt-2 text-[13.5px]">
            {resumen.trimestres.map((t) => (
              <li
                key={t.trimestre}
                className={`flex justify-between border-b border-line-soft py-1.5 last:border-b-0 ${
                  t.trimestre === trimestre ? "font-semibold text-ink" : "text-ink-2"
                }`}
              >
                <span>{t.trimestre}T</span>
                <span className="mono">{formatEur(t.pagoTrimestre)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {sinDatos && (
        <p className="empty mt-7">
          Aún no hay datos de este ejercicio. Empieza por{" "}
          <Link
            href="/pro/contabilidad/configuracion"
            className="font-medium text-accent hover:underline"
          >
            configurar tu perfil fiscal
          </Link>{" "}
          y{" "}
          <Link
            href="/pro/contabilidad/gastos"
            className="font-medium text-accent hover:underline"
          >
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
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="mono mt-0.5 text-[15px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function Cifra({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className="mono mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[12.5px] text-ink-2">{hint}</div>}
    </div>
  );
}
