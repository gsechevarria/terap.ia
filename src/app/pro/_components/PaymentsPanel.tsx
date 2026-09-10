"use client";
import { callAction } from "@/lib/action-result";

import { PaymentFiscalEditor } from "./PaymentFiscalEditor";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackAction,
  setPackActiveAction,
  deletePaymentAction,
  registerPaymentAction,
  setPaymentMethodAction,
  setPaymentStatusAction,
  upsertPriceAction,
} from "@/lib/actions/payments";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { PatientPaymentDetail } from "@/lib/queries/payments";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payment-methods";

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
    <div className="flex flex-col gap-5">
      {error && <p role="alert" className="text-danger">{error}</p>}
      <p className="text-xs text-ink-2">Importes brutos, incluido IVA y antes de retenciones. Seguimiento de pagos; no emite facturas.</p>
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="card px-4 py-3">
          <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            Deuda pendiente
          </div>
          <div className="mt-0.5 text-lg font-semibold">
            {formatCurrency(detail.debtCents)}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            Sesiones de bono
          </div>
          <div className="mt-0.5 text-lg font-semibold">{detail.packRemaining}</div>
        </div>
      </div>

      {/* Precio */}
      <div className="card bg-panel p-4">
        <h3 className="section-label">Precio por sesión</h3>
        <div className="mt-3 flex items-center gap-2">
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
      </div>

      {/* Bonos */}
      <div className="card bg-panel p-4">
        <h3 className="section-label">Bonos</h3>
        {detail.packs.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {detail.packs.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  Bono de {p.total_sessions} · usadas {p.used_sessions}/
                  {p.total_sessions}
                  {!p.active && " (inactivo)"}
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
      </div>

      {/* Sesiones y pagos */}
      <div className="card bg-panel p-4">
        <h3 className="section-label">Sesiones y pagos</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <p className="mt-3 text-sm text-ink-2">Sin sesiones ni pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
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
                    <td className="tabular-nums whitespace-nowrap">
                      {formatCurrency(p.amount_cents, p.currency)}
                      <PaymentFiscalEditor paymentId={p.id} patientId={patientId} snapshot={p.fiscal_snapshot} />
                      {/* "Sin tarifa configurada" no es lo mismo que "gratis":
                          un 0,00 € a secas parecía una deuda saldada. */}
                      {p.note?.startsWith("Sin tarifa") && (
                        <span
                          className="ml-2 chip bg-warn-soft text-warn"
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
                          <option value="">— Sin especificar</option>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {paymentMethodLabel(m)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            callAction(setPaymentStatusAction,
                              p.id,
                              patientId,
                              p.status === "paid" ? "pending" : "paid",
                            ),
                          )
                        }
                        title="Cambiar estado"
                        className="st rounded px-1 py-0.5 transition-colors hover:bg-wash"
                      >
                        <span
                          className={`dot ${p.status === "paid" ? "d-success" : "d-warn"}`}
                        />
                        {p.status === "paid" ? "Pagado" : "Pendiente"}
                      </button>
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
      </div>

      <p className="text-xs text-ink-3">
        terap.ia hace seguimiento de pagos; no emite facturas.
      </p>
    </div>
  );
}
