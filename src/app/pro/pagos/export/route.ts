import {
  getProfessionalPayments,
  PAYMENT_METHOD_FILTERS,
} from "@/lib/queries/payments";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { isValidYMD, fromDateToISO, toDateToISO } from "@/lib/date-ranges";

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export CSV de pagos para la gestoría (no es una factura). Respeta los mismos
 * filtros que el histórico (rango de fechas, estado, método, paciente).
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const fromRaw = sp.get("from") ?? undefined;
  const toRaw = sp.get("to") ?? undefined;
  const from = isValidYMD(fromRaw) ? fromRaw : undefined;
  const to = isValidYMD(toRaw) ? toRaw : undefined;
  const statusRaw = sp.get("status");
  const status =
    statusRaw === "paid" || statusRaw === "pending" ? statusRaw : undefined;
  const methodRaw = sp.get("method") ?? "";
  const method = (PAYMENT_METHOD_FILTERS as readonly string[]).includes(methodRaw)
    ? methodRaw
    : undefined;
  const patientId = sp.get("patient") || undefined;

  const { rows } = await getProfessionalPayments({
    fromISO: from ? fromDateToISO(from) : undefined,
    toISO: to ? toDateToISO(to) : undefined,
    status,
    method,
    patientId,
  });

  const header = ["fecha", "paciente", "importe_eur", "moneda", "estado", "metodo"];
  const body = rows.map((p) => [
    (p.paid_at ?? p.created_at).slice(0, 10),
    p.patientName ?? "",
    (p.amount_cents / 100).toFixed(2),
    p.currency,
    p.status === "paid" ? "pagado" : "pendiente",
    paymentMethodLabel(p.method),
  ]);

  const csv = [header, ...body].map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pagos-terapia.csv"`,
    },
  });
}
