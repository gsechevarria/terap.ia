import { getAllPaymentsForExport } from "@/lib/queries/payments";

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV de pagos para la gestoría (no es una factura). */
export async function GET() {
  const rows = await getAllPaymentsForExport();
  const header = ["fecha", "paciente", "importe_eur", "moneda", "estado", "metodo"];
  const body = rows.map((p) => [
    p.created_at,
    p.patientName ?? "",
    (p.amount_cents / 100).toFixed(2),
    p.currency,
    p.status === "paid" ? "pagado" : "pendiente",
    p.method ?? "",
  ]);

  const csv = [header, ...body].map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pagos-terapia.csv"`,
    },
  });
}
