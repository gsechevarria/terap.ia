"use client";
import { callAction } from "@/lib/action-result";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackAction,
  setPackActiveAction,
  deletePaymentAction,
  registerPaymentAction,
  setPaymentMethodAction,
  upsertPriceAction,
} from "@/lib/actions/payments";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { PatientPaymentDetail } from "@/lib/queries/payments";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payment-methods";
import { Status } from "@/components/ui/Status";

export function PaymentsPanel({
  patientId,
  detail,
}: {
  patientId: string;
  detail: PatientPaymentDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const packRequest = useRef<string | null>(null);
  const run = (fn: () => Promise<void>) => startTransition(async () => {
    setError("");
    try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
  });

  const [price, setPrice] = useState(
    detail.price ? String(detail.price.price_cents / 100) : "",
  );
  const [packSessions, setPackSessions] = useState(5);
  const [packPrice, setPackPrice] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payStatus, setPayStatus] = useState<"paid" | "pending">("pending");
  const [payMethod, setPayMethod] = useState("");

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      {/* Resumen: dos cifras sin caja. Eran dos tarjetas iguales en mosaico, que
          es justo lo que el sistema visual no quiere: decían que la deuda y el
          bono pesan lo mismo, y no es verdad — la deuda es lo que se mira. */}
      <div className="flex flex-wrap gap-x-12 gap-y-5">
        <div>
          <div className="text-[13px] text-ink-3">Deuda pendiente</div>
          <div className="figure mono mt-1">{formatCurrency(detail.debtCents)}</div>
        </div>
        <div>
          <div className="text-[13px] text-ink-3">Sesiones de bono</div>
          <div className="figure mono mt-1">{detail.packRemaining}</div>
        </div>
      </div>

      {/* Precio */}
      <section className="border-t border-line pt-7">
        <h3 className="section-title mb-3.5">Precio por sesión</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="60.00"
            className="field w-32"
          />
          <span className="text-sm text-ink-2">€</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => callAction(upsertPriceAction, patientId, price === "" ? NaN : Number(price)))}
            className="btn-primary"
          >
            Guardar
          </button>
        </div>
      </section>

      {/* Bonos */}
      <section className="border-t border-line pt-7">
        <h3 className="section-title mb-3.5">Bonos</h3>
        {detail.packs.length > 0 && (
          <ul className="mb-3.5 flex flex-col gap-2 text-[13.5px]">
            {detail.packs.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  Bono de {p.total_sessions}, usadas {p.used_sessions} de{" "}
                  {p.total_sessions}
                  {!p.active && (
                    <span className="text-ink-3"> (inactivo)</span>
                  )}
                  <button type="button" disabled={pending} className="btn-subtle ml-2 text-xs" onClick={() => run(() => callAction(setPackActiveAction, patientId, p.id, !p.active))}>{p.active ? "Archivar" : "Reactivar"}</button>
                </span>
                <span className="text-ink-2">
                  {p.price_cents != null ? formatCurrency(p.price_cents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={packSessions}
            onChange={(e) => { setPackSessions(Number(e.target.value)); packRequest.current = null; }}
            className="field w-auto"
          >
            <option value={5}>5 sesiones</option>
            <option value={10}>10 sesiones</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={packPrice}
            onChange={(e) => { setPackPrice(e.target.value); packRequest.current = null; }}
            placeholder="Precio del bono €"
            className="field w-40"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                callAction(addPackAction, patientId, packSessions, packPrice === "" ? NaN : Number(packPrice), packRequest.current ??= crypto.randomUUID()).then(() => { packRequest.current = null; }),
              )
            }
            className="btn-ghost"
          >
            Añadir bono
          </button>
        </div>
      </section>

      {/* Sesiones y pagos */}
      <section className="border-t border-line pt-7">
        <h3 className="section-title mb-3.5">Sesiones y pagos</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Importe €"
            className="field w-32"
          />
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            className="field w-auto"
          >
            <option value="">Método…</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel(m)}
              </option>
            ))}
          </select>
          <select
            value={payStatus}
            onChange={(e) => setPayStatus(e.target.value as "paid" | "pending")}
            className="field w-auto"
          >
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
          </select>
          <button
            type="button"
            disabled={pending || !payAmount}
            onClick={() =>
              run(async () => {
                await callAction(registerPaymentAction,
                  patientId,
                  payAmount === "" ? NaN : Number(payAmount),
                  payStatus,
                  payMethod || null,
                );
                setPayAmount("");
                setPayMethod("");
              })
            }
            className="btn-primary"
          >
            Registrar pago
          </button>
        </div>

        {detail.payments.length === 0 ? (
          <p className="mt-4 py-3 text-[13.5px] text-ink-3">
            Todavía no hay ningún cobro. Se anotan solos al registrar la
            asistencia a una cita, o a mano con el formulario de arriba.
          </p>
        ) : (
          // La tabla solo se muestra a partir de `sm`. Por debajo, el método y
          // el estado quedaban fuera de pantalla y había que desplazar en
          // horizontal justo para llegar a los dos controles que se usan. En
          // móvil cada pago es una tarjeta y todo cabe.
          <div className="table-wrap mt-4 hidden sm:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Sesión</th>
                  <th>Importe</th>
                  <th>Método de pago</th>
                  <th>Estado</th>
                  <th className="w-0" />
                </tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id} className="group">
                    <td className="whitespace-nowrap">
                      {p.sessionAt ? (
                        formatDateTime(p.sessionAt)
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {formatDate(p.created_at)}
                          {/* La venta de un bono es un cobro, no una sesión
                              suelta: sin distinguirlo se confundía con un pago
                              manual cualquiera. */}
                          <span className="chip">
                            {p.session_pack_id && !p.appointment_id
                              ? "venta de bono"
                              : "manual"}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="mono whitespace-nowrap">
                      {formatCurrency(p.amount_cents, p.currency)}
                      {/* "Sin tarifa configurada" no es lo mismo que "gratis":
                          un 0,00 € a secas parecía una deuda saldada. */}
                      {p.note?.startsWith("Sin tarifa") && (
                        <span
                          className="ml-2 text-[12.5px] font-medium text-warning-ink"
                          title={p.note}
                        >
                          revisar importe
                        </span>
                      )}
                    </td>
                    <td>
                      {/* Consumo de bono (imputación de sesión a 0 €): no
                          tiene método de pago propio. La VENTA del bono sí,
                          porque es un cobro real. */}
                      {p.session_pack_id && p.appointment_id ? (
                        <span className="chip">Bono</span>
                      ) : (
                        <select
                          value={p.method ?? ""}
                          disabled={pending}
                          onChange={(e) =>
                            run(() =>
                              callAction(setPaymentMethodAction,
                                p.id,
                                patientId,
                                e.target.value || null,
                              ),
                            )
                          }
                          className="field w-auto"
                          aria-label="Método de pago"
                        >
                          <option value="">Pendiente de cobro</option>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {paymentMethodLabel(m)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <Status tone={p.status === "paid" ? "success" : "warn"}>
                        {p.status === "paid" ? "Cobrado" : "Pendiente"}
                      </Status>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => callAction(deletePaymentAction, p.id, patientId))}
                        className="btn-danger btn-sm opacity-100 transition-opacity duration-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Móvil: una tarjeta por pago, con el método y el estado a la vista. */}
        {detail.payments.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 sm:hidden">
            {detail.payments.map((p) => {
              const esConsumoBono = Boolean(p.session_pack_id && p.appointment_id);
              return (
                <li key={p.id} className="card flex flex-col gap-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        {p.sessionAt ? formatDateTime(p.sessionAt) : formatDate(p.created_at)}
                      </p>
                      {!p.sessionAt && (
                        <span className="chip mt-1">
                          {p.session_pack_id && !p.appointment_id
                            ? "venta de bono"
                            : "manual"}
                        </span>
                      )}
                    </div>
                    <span className="mono shrink-0 text-[13px] font-semibold text-ink">
                      {formatCurrency(p.amount_cents, p.currency)}
                    </span>
                  </div>

                  {esConsumoBono ? (
                    <span className="chip self-start">Cubierta por bono</span>
                  ) : (
                    <select
                      value={p.method ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        run(() =>
                          callAction(
                            setPaymentMethodAction,
                            p.id,
                            patientId,
                            e.target.value || null,
                          ),
                        )
                      }
                      className="field"
                      aria-label="Método de pago"
                    >
                      <option value="">Pendiente de cobro</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {paymentMethodLabel(m)}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <Status tone={p.status === "paid" ? "success" : "warn"}>
                      {p.status === "paid" ? "Cobrado" : "Pendiente"}
                    </Status>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => callAction(deletePaymentAction, p.id, patientId))}
                      className="btn-danger btn-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="border-t border-line pt-5 text-[12.5px] text-ink-3">
        terap.ia hace seguimiento de pagos; no emite facturas.
      </p>
    </div>
  );
}
