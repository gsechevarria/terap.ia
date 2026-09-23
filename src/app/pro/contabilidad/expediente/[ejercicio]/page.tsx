import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleAlert } from "lucide-react";
import {
  PASOS,
  esPasoValido,
  getChecklistPersonal,
  getEjerciciosDisponibles,
  getFacturas,
  getResumenExpediente,
  getRetenciones,
  type PasoClave,
} from "@/lib/queries/expediente";
import { getConfiguracionFiscal } from "@/lib/queries/contabilidad";
import { formatCurrency } from "@/lib/format";
import { DescargoFiscal } from "@/app/pro/contabilidad/_components/DescargoFiscal";
import { DescargaExpediente } from "@/app/pro/contabilidad/_components/DescargaExpediente";
import { EstadoExpediente } from "@/app/pro/contabilidad/_components/EstadoExpediente";
import { PerfilFiscalForm } from "@/app/pro/contabilidad/_components/PerfilFiscalForm";
import { RetencionesPanel } from "@/app/pro/contabilidad/_components/RetencionesPanel";
import { ChecklistPersonal } from "@/app/pro/contabilidad/_components/ChecklistPersonal";
import { FacturasPanel } from "@/app/pro/contabilidad/_components/FacturasPanel";
import { Status, type StatusTone } from "@/components/ui/Status";

const ESTADO_TONO: Record<string, { label: string; tone: StatusTone }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  pendiente_informacion: { label: "Pendiente de información", tone: "warn" },
  preparado_revision: { label: "Preparado para revisión", tone: "info" },
  revisado: { label: "Revisado", tone: "success" },
};

export default async function ExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ ejercicio: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const { ejercicio: ejercicioRaw } = await params;
  const { paso: pasoRaw } = await searchParams;

  const ejercicio = Number(ejercicioRaw);
  if (!Number.isInteger(ejercicio) || ejercicio < 2015 || ejercicio > 2100) notFound();

  const paso: PasoClave = esPasoValido(pasoRaw) ? pasoRaw : "perfil";

  const [resumen, ejercicios, config, retenciones, checklist, facturas] = await Promise.all([
    getResumenExpediente(ejercicio),
    getEjerciciosDisponibles(),
    getConfiguracionFiscal(),
    getRetenciones(ejercicio),
    getChecklistPersonal(ejercicio),
    getFacturas(ejercicio),
  ]);

  const completos = resumen.pasos.filter((p) => p.completo).length;
  // "Revisado" es el propio paso de revisión: incluirlo lo haría incompleto
  // siempre, hasta el segundo justo antes de marcarlo.
  const pasosIncompletos = resumen.pasos.filter(
    (p) => !p.completo && p.clave !== "revision",
  );
  const estado = resumen.expediente?.estado ?? "borrador";
  const estadoInfo = ESTADO_TONO[estado] ?? ESTADO_TONO.borrador!;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/pro/contabilidad"
        className="inline-flex items-center gap-1.5 text-label-sm text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
        Contabilidad
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Expediente fiscal {ejercicio}</h1>
          <p className="mt-1.5 text-body-sm text-ink-2">
            Recopilación para que su gestor prepare la declaración. La aplicación
            no presenta nada ante la AEAT ni calcula la cuota de la renta.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Status tone={estadoInfo.tone}>{estadoInfo.label}</Status>
          {/* Selector de ejercicio: el de presentación no es el declarado. */}
          <nav aria-label="Ejercicio" className="flex gap-1">
            {ejercicios.map((año) => (
              <Link
                key={año}
                href={`/pro/contabilidad/expediente/${año}?paso=${paso}`}
                aria-current={año === ejercicio ? "page" : undefined}
                className={`mono rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  año === ejercicio
                    ? "bg-accent-soft text-accent"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {año}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mt-5">
        <DescargoFiscal />
      </div>

      {resumen.territorioAsumido && (
        <p className="mt-3 flex items-start gap-2.5 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-ink">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-warn" />
          <span>
            Se está asumiendo <strong className="font-medium">territorio común</strong> sin
            confirmar. Si la actividad tributa en régimen foral, en Canarias, Ceuta
            o Melilla, estos cálculos no le son aplicables: confírmelo en el primer
            paso.
          </span>
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Pasos */}
        <nav aria-label="Pasos del expediente" className="lg:col-span-4">
          <p className="section-label mb-2.5">
            Avance{" "}
            <span className="mono font-normal normal-case">
              {completos} de {PASOS.length}
            </span>
          </p>
          <ol className="card divide-y divide-line overflow-hidden">
            {resumen.pasos.map((p, i) => {
              const activo = p.clave === paso;
              return (
                <li key={p.clave}>
                  <Link
                    href={`/pro/contabilidad/expediente/${ejercicio}?paso=${p.clave}`}
                    aria-current={activo ? "step" : undefined}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                      activo ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mono mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        p.completo
                          ? "bg-success text-white"
                          : "border border-line-strong text-ink-3"
                      }`}
                    >
                      {p.completo ? <Check size={11} strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-[13px] ${activo ? "font-semibold text-accent" : "text-ink"}`}
                      >
                        {p.titulo}
                      </span>
                      {p.faltan.length > 0 && (
                        <span className="block text-[11px] text-ink-3">
                          {p.faltan[0]}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Contenido del paso */}
        <div className="min-w-0 lg:col-span-8">
          {paso === "perfil" && (
            <PerfilFiscalForm
              config={config}
              faltan={resumen.pasos.find((p) => p.clave === "perfil")?.faltan ?? []}
            />
          )}

          {paso === "ingresos" && (
            <div className="flex flex-col gap-6">
              {/* Cobros y facturación son cosas distintas y se ven separadas:
                  el dinero que entró vive en los cobros; lo emitido, aquí. */}
              <PasoPendiente
                titulo="Cobros del ejercicio"
                descripcion="Lo que ha entrado en caja, derivado de la ficha de cada paciente. No se duplica aquí."
                enlace={{ href: "/pro/contabilidad/revision", texto: "Revisar cobros pendientes" }}
                dato={`${formatCurrency(resumen.totales.ingresosConfirmadosCents)} confirmados${
                  resumen.totales.ingresosPendientes > 0
                    ? `, ${resumen.totales.ingresosPendientes} sin tratamiento fiscal`
                    : ""
                }`}
              />
              <FacturasPanel ejercicio={ejercicio} facturas={facturas} />
            </div>
          )}

          {paso === "gastos" && (
            <PasoPendiente
              titulo="Gastos"
              descripcion="Los gastos del ejercicio se registran y editan en su propia pantalla, con justificante y porcentaje de afectación."
              enlace={{ href: "/pro/contabilidad/gastos", texto: "Ir a gastos" }}
              dato={`${formatCurrency(resumen.totales.gastosConfirmadosCents)} confirmados${
                resumen.totales.gastosPendientes > 0
                  ? `, ${resumen.totales.gastosPendientes} sin IVA recuperable`
                  : ""
              }`}
            />
          )}

          {paso === "bienes" && (
            <PasoPendiente
              titulo="Bienes y amortizaciones"
              descripcion="Un gasto marcado como bien de inversión genera su ficha de amortización. Se revisan desde la misma pantalla de gastos."
              enlace={{ href: "/pro/contabilidad/gastos", texto: "Ir a gastos" }}
            />
          )}

          {paso === "retenciones" && (
            <RetencionesPanel ejercicio={ejercicio} retenciones={retenciones} />
          )}

          {paso === "personal" && (
            <ChecklistPersonal ejercicio={ejercicio} respuestas={checklist} />
          )}

          {paso === "revision" && (
            <div className="flex flex-col gap-6">
              <section className="card p-6">
                <h2 className="card-title">Obligaciones formales</h2>
                <p className="mt-1 text-body-sm text-ink-2">
                  Ninguna se asigna por defecto: se determinan con lo declarado, y
                  lo que no puede determinarse queda pendiente en lugar de darse
                  por descartado.
                </p>
                <ul className="mt-4 divide-y divide-line">
                  {resumen.obligaciones.map((o) => (
                    <li key={o.modelo} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">
                          <span className="mono">Modelo {o.modelo}</span>, {o.nombre}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-2">{o.explicacion}</p>
                        {o.faltan && o.faltan.length > 0 && (
                          <ul className="mt-1.5 list-inside list-disc text-[11px] text-ink-3">
                            {o.faltan.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Status
                        tone={
                          o.determinacion === "obligado"
                            ? "info"
                            : o.determinacion === "no_obligado"
                              ? "success"
                              : "warn"
                        }
                      >
                        {o.determinacion === "obligado"
                          ? "Obligado"
                          : o.determinacion === "no_obligado"
                            ? "No obligado"
                            : "Pendiente"}
                      </Status>
                    </li>
                  ))}
                </ul>
              </section>

              <EstadoExpediente
                ejercicio={ejercicio}
                estado={estado}
                revisadoPor={resumen.expediente?.revisado_por ?? null}
                revisadoAt={resumen.expediente?.revisado_at ?? null}
                notaGestor={resumen.expediente?.nota_gestor ?? null}
                existe={resumen.expediente !== null}
                pasosIncompletos={pasosIncompletos}
              />

              {/* La descarga va al final: se ofrece cuando ya se ha visto qué
                  falta, no antes de mirarlo. */}
              <DescargaExpediente
                ejercicio={ejercicio}
                pasosIncompletos={pasosIncompletos}
                registrosApartados={
                  resumen.totales.ingresosPendientes + resumen.totales.gastosPendientes
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Paso que todavía vive en otra pantalla, o que está por construir. */
function PasoPendiente({
  titulo,
  descripcion,
  enlace,
  dato,
}: {
  titulo: string;
  descripcion: string;
  enlace?: { href: string; texto: string };
  dato?: string;
}) {
  return (
    <section className="card p-6">
      <h2 className="card-title">{titulo}</h2>
      <p className="mt-1.5 text-body-sm text-ink-2">{descripcion}</p>
      {dato && (
        <p className="mono mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink">
          {dato}
        </p>
      )}
      {enlace && (
        <Link href={enlace.href} className="btn-ghost mt-4">
          {enlace.texto}
        </Link>
      )}
    </section>
  );
}
