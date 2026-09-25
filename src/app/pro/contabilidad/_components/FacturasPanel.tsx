"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import {
  borrarFacturaAction,
  cambiarEstadoFacturaAction,
  guardarFacturaAction,
} from "@/lib/actions/facturas";
import { formatCurrency, formatDate } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";
import type { Factura } from "@/lib/queries/expediente";
import type { Enums } from "@/lib/database.types";

const DESTINATARIOS: { valor: Enums<"tipo_destinatario">; etiqueta: string }[] = [
  { valor: "particular", etiqueta: "Particular" },
  { valor: "clinica", etiqueta: "Clínica" },
  { valor: "aseguradora", etiqueta: "Aseguradora" },
  { valor: "empresa", etiqueta: "Empresa" },
  { valor: "profesional", etiqueta: "Profesional" },
  { valor: "otro", etiqueta: "Otro" },
];

const SERVICIOS: { valor: Enums<"categoria_servicio">; etiqueta: string }[] = [
  { valor: "asistencia_sanitaria", etiqueta: "Asistencia sanitaria" },
  { valor: "formacion", etiqueta: "Formación" },
  { valor: "peritaje", etiqueta: "Peritaje" },
  { valor: "consultoria", etiqueta: "Consultoría" },
  { valor: "seleccion_personal", etiqueta: "Selección de personal" },
  { valor: "coaching", etiqueta: "Coaching" },
  { valor: "otro", etiqueta: "Otro" },
];

const ESTADO_TONO: Record<string, { label: string; tone: StatusTone }> = {
  propuesto: { label: "Propuesto", tone: "info" },
  confirmado: { label: "Confirmado", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warn" },
  excluido: { label: "Excluido", tone: "neutral" },
};

const IVA_TONO: Record<string, { label: string; tone: StatusTone }> = {
  sujeta: { label: "Sujeta", tone: "info" },
  exenta: { label: "Exenta", tone: "neutral" },
  no_sujeta: { label: "No sujeta", tone: "neutral" },
  pendiente: { label: "IVA sin determinar", tone: "warn" },
};

export function FacturasPanel({
  ejercicio,
  facturas,
}: {
  ejercicio: number;
  facturas: Factura[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [abierto, setAbierto] = useState(false);

  const [serie, setSerie] = useState("");
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState<Enums<"tipo_factura">>("ordinaria");
  const [rectificaA, setRectificaA] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [nif, setNif] = useState("");
  const [tipoDest, setTipoDest] = useState<Enums<"tipo_destinatario">>("particular");
  const [servicio, setServicio] = useState<Enums<"categoria_servicio">>("asistencia_sanitaria");
  const [base, setBase] = useState("");
  const [tratamiento, setTratamiento] = useState<Enums<"tratamiento_iva">>("pendiente");
  const [tipoIva, setTipoIva] = useState("21");
  const [retencion, setRetencion] = useState("15");
  const [notas, setNotas] = useState("");

  function guardar() {
    run(async () => {
      await callAction(guardarFacturaAction, {
        serie,
        numero,
        tipo,
        rectificaA: tipo === "rectificativa" ? rectificaA || null : null,
        fechaEmision,
        fechaOperacion: null,
        ejercicioImputacion: ejercicio,
        destinatarioNombre: destinatario,
        destinatarioNif: nif,
        destinatarioTipo: tipoDest,
        categoriaServicio: servicio,
        baseEuros: base === "" ? NaN : Number(base),
        tratamientoIva: tratamiento,
        tipoIva: tratamiento === "sujeta" ? Number(tipoIva) : null,
        retencionPct: retencion === "" ? 0 : Number(retencion),
        notas,
      });
      setSerie("");
      setNumero("");
      setBase("");
      setNotas("");
      setAbierto(false);
      router.refresh();
    });
  }

  const totalBase = facturas
    .filter((f) => f.estado !== "excluido")
    .reduce((s, f) => s + f.base_cents, 0);
  const sinDeterminar = facturas.filter((f) => f.tratamiento_iva === "pendiente").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="card-title">Libro registro de facturas emitidas</h2>
            <p className="mt-1.5 text-body-sm text-ink-2">
              Aquí se <strong className="font-medium text-ink">anotan</strong> las
              facturas emitidas fuera de la aplicación. Terap no emite
              facturas ni genera ningún documento: eso es lo que la mantiene
              fuera del alcance de Verifactu.
            </p>
          </div>
          <button type="button" onClick={() => setAbierto(!abierto)} className="btn-primary shrink-0">
            {abierto ? "Cerrar" : "Anotar factura"}
          </button>
        </div>

        <p className="mono mt-4 rounded-md bg-surface-muted px-4 py-3 text-[13.5px] text-ink">
          {formatCurrency(totalBase)} de base en {facturas.length}{" "}
          {facturas.length === 1 ? "factura" : "facturas"}
          {sinDeterminar > 0 && `, ${sinDeterminar} con el IVA sin determinar`}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-[13.5px] text-danger-ink">
            {error}
          </p>
        )}

        {abierto && (
          <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Serie</span>
              <input value={serie} onChange={(e) => setSerie(e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Número</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className="field" />
            </label>

            <label className="block">
              <span className="field-label">Tipo</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Enums<"tipo_factura">)}
                className="field"
              >
                <option value="ordinaria">Ordinaria</option>
                <option value="rectificativa">Rectificativa</option>
                <option value="anticipo">Anticipo</option>
              </select>
            </label>

            {tipo === "rectificativa" ? (
              <label className="block">
                <span className="field-label">Rectifica a</span>
                <select
                  value={rectificaA}
                  onChange={(e) => setRectificaA(e.target.value)}
                  className="field"
                >
                  <option value="">Elija la factura</option>
                  {facturas
                    .filter((f) => f.tipo !== "rectificativa")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {[f.serie, f.numero].filter(Boolean).join("-") || formatDate(f.fecha_emision)}
                        {", "}
                        {formatCurrency(f.total_cents)}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="field-label">Fecha de emisión</span>
                <input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  className="field"
                />
              </label>
            )}

            {tipo === "rectificativa" && (
              <label className="block">
                <span className="field-label">Fecha de emisión</span>
                <input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  className="field"
                />
              </label>
            )}

            <label className="block">
              <span className="field-label">Destinatario</span>
              <input
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                className="field"
              />
            </label>
            <label className="block">
              <span className="field-label">NIF del destinatario</span>
              <input value={nif} onChange={(e) => setNif(e.target.value)} className="field" />
            </label>

            <label className="block">
              <span className="field-label">Tipo de destinatario</span>
              <select
                value={tipoDest}
                onChange={(e) => setTipoDest(e.target.value as Enums<"tipo_destinatario">)}
                className="field"
              >
                {DESTINATARIOS.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Servicio prestado</span>
              <select
                value={servicio}
                onChange={(e) => setServicio(e.target.value as Enums<"categoria_servicio">)}
                className="field"
              >
                {SERVICIOS.map((sv) => (
                  <option key={sv.valor} value={sv.valor}>
                    {sv.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Base (€)</span>
              <input
                type="number"
                step="0.01"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="field"
              />
            </label>

            <label className="block">
              <span className="field-label">Tratamiento de IVA</span>
              <select
                value={tratamiento}
                onChange={(e) => setTratamiento(e.target.value as Enums<"tratamiento_iva">)}
                className="field"
              >
                <option value="pendiente">Sin determinar</option>
                <option value="exenta">Exenta</option>
                <option value="no_sujeta">No sujeta</option>
                <option value="sujeta">Sujeta</option>
              </select>
            </label>

            {tratamiento === "sujeta" && (
              <label className="block">
                <span className="field-label">Tipo de IVA (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tipoIva}
                  onChange={(e) => setTipoIva(e.target.value)}
                  className="field"
                />
              </label>
            )}

            <label className="block">
              <span className="field-label">Retención (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={retencion}
                onChange={(e) => setRetencion(e.target.value)}
                className="field"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="field-label">Notas</span>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} className="field" />
            </label>

            {/* El servicio describe lo hecho; NO decide la tributación. La
                exención sanitaria depende de la titulación del profesional y de
                la finalidad asistencial, no del epígrafe ni de quién paga. */}
            <p className="rounded-md bg-surface-muted px-4 py-3 text-[12.5px] text-ink-2 sm:col-span-2">
              La categoría del servicio describe qué se hizo y no determina su
              tributación. Deje el IVA «sin determinar» si no está seguro: el
              expediente lo señalará en lugar de suponerlo.
            </p>

            <button
              type="button"
              disabled={pending || base === "" || !fechaEmision}
              onClick={guardar}
              className="btn-primary sm:col-span-2"
            >
              {pending ? "Guardando…" : "Anotar factura"}
            </button>
          </div>
        )}
      </section>

      {facturas.length > 0 && (
        <section className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {facturas.map((f) => {
              const est = ESTADO_TONO[f.estado] ?? ESTADO_TONO.propuesto!;
              const iva = IVA_TONO[f.tratamiento_iva] ?? IVA_TONO.pendiente!;
              const rectifica = facturas.find((x) => x.id === f.rectifica_a);
              return (
                <li key={f.id} className="group px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        <span className="mono">
                          {[f.serie, f.numero].filter(Boolean).join("-") || "Sin numerar"}
                        </span>
                        {f.tipo !== "ordinaria" && (
                          <span className="chip ml-2">
                            {f.tipo === "rectificativa" ? "rectificativa" : "anticipo"}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-2">
                        {formatDate(f.fecha_emision)}
                        {f.destinatario_nombre ? `, ${f.destinatario_nombre}` : ""}
                        {rectifica
                          ? `. Rectifica a ${[rectifica.serie, rectifica.numero].filter(Boolean).join("-")}`
                          : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Status tone={est.tone}>{est.label}</Status>
                        <Status tone={iva.tone}>{iva.label}</Status>
                        {f.retencion_cents != null && f.retencion_cents > 0 && (
                          <span className="chip">
                            retención {formatCurrency(f.retencion_cents)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="mono text-[13px] font-semibold">
                        {formatCurrency(f.total_cents)}
                      </span>
                      {f.estado !== "confirmado" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              await callAction(cambiarEstadoFacturaAction, f.id, ejercicio, "confirmado");
                              router.refresh();
                            })
                          }
                          className="btn-ghost btn-sm"
                        >
                          Confirmar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Eliminar factura"
                        onClick={() =>
                          run(async () => {
                            await callAction(borrarFacturaAction, f.id, ejercicio);
                            router.refresh();
                          })
                        }
                        className="btn-danger btn-sm opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      >
                        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
