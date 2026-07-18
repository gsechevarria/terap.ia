"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackAction,
  deletePaymentAction,
  registerPaymentAction,
  setPaymentStatusAction,
  upsertPriceAction,
} from "@/lib/actions/payments";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PatientPaymentDetail } from "@/lib/queries/payments";

const inputCls =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]";

export function PaymentsPanel({
  patientId,
  detail,
}: {
  patientId: string;
  detail: PatientPaymentDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const [price, setPrice] = useState(
    detail.price ? String(detail.price.price_cents / 100) : "",
  );
  const [packSessions, setPackSessions] = useState(5);
  const [packPrice, setPackPrice] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payStatus, setPayStatus] = useState<"paid" | "pending">("pending");

  return (
    <div className="flex flex-col gap-5">
      {/* Resumen */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-black/[.08] px-4 py-2 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Deuda pendiente</div>
          <div className="font-semibold">{formatCurrency(detail.debtCents)}</div>
        </div>
        <div className="rounded-lg border border-black/[.08] px-4 py-2 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Sesiones de bono</div>
          <div className="font-semibold">{detail.packRemaining}</div>
        </div>
      </div>

      {/* Precio */}
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Precio por sesión</h3>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="60.00"
            className={`${inputCls} w-32`}
          />
          <span className="text-sm text-neutral-500">€</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => upsertPriceAction(patientId, Number(price) || 0))}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Bonos */}
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Bonos</h3>
        {detail.packs.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {detail.packs.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  Bono de {p.total_sessions} · usadas {p.used_sessions}/
                  {p.total_sessions}
                  {!p.active && " (inactivo)"}
                </span>
                <span className="text-neutral-500">
                  {p.price_cents != null ? formatCurrency(p.price_cents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={packSessions}
            onChange={(e) => setPackSessions(Number(e.target.value))}
            className={inputCls}
          >
            <option value={5}>5 sesiones</option>
            <option value={10}>10 sesiones</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={packPrice}
            onChange={(e) => setPackPrice(e.target.value)}
            placeholder="Precio del bono €"
            className={`${inputCls} w-40`}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                addPackAction(patientId, packSessions, Number(packPrice) || 0),
              )
            }
            className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium disabled:opacity-60 dark:border-white/[.16]"
          >
            Añadir bono
          </button>
        </div>
      </div>

      {/* Pagos */}
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Pagos</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Importe €"
            className={`${inputCls} w-32`}
          />
          <select
            value={payStatus}
            onChange={(e) => setPayStatus(e.target.value as "paid" | "pending")}
            className={inputCls}
          >
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
          </select>
          <button
            type="button"
            disabled={pending || !payAmount}
            onClick={() =>
              run(async () => {
                await registerPaymentAction(patientId, Number(payAmount) || 0, payStatus);
                setPayAmount("");
              })
            }
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            Registrar pago
          </button>
        </div>

        {detail.payments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Sin pagos registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {detail.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-black/[.06] px-3 py-2 text-sm dark:border-white/[.1]"
              >
                <span>
                  {formatCurrency(p.amount_cents, p.currency)}
                  {p.method ? ` · ${p.method}` : ""}
                  <span className="ml-2 text-xs text-neutral-400">
                    {formatDate(p.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setPaymentStatusAction(
                          p.id,
                          patientId,
                          p.status === "paid" ? "pending" : "paid",
                        ),
                      )
                    }
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      p.status === "paid"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {p.status === "paid" ? "pagado" : "pendiente"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deletePaymentAction(p.id, patientId))}
                    className="text-xs text-neutral-400 underline hover:text-red-600"
                  >
                    eliminar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        terap.ia hace seguimiento de pagos; no emite facturas.
      </p>
    </div>
  );
}
