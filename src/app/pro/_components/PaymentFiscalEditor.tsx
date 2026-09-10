"use client";
import { callAction } from "@/lib/action-result";

import type { Json } from "@/lib/database.types";
import { useState } from "react";
import { useAction } from "@/lib/use-action";
import { setPaymentFiscalAction } from "@/lib/actions/payments";
export function PaymentFiscalEditor({ paymentId, patientId, snapshot }: { paymentId: string; patientId: string; snapshot: Json | null }) {
  const saved = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : null;
  const [tipo, setTipo] = useState<"exenta" | "sujeta">(saved?.tipo_operacion === "sujeta" ? "sujeta" : "exenta");
  const [iva, setIva] = useState(typeof saved?.tipo_iva === "number" ? saved.tipo_iva : 21);
  const [retencion, setRetencion] = useState(typeof saved?.retencion_cents === "number" ? String(saved.retencion_cents / 100) : "0");
  const { run, pending, error } = useAction();
  return <details className="text-xs"><summary>{saved ? "Revisar tratamiento fiscal" : "Pendiente de revisión fiscal"}</summary>
    <p>El importe registrado es bruto, incluido IVA y antes de retención. Confirma los datos de esta operación.</p>
    <label>Operación <select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="exenta">Exenta</option><option value="sujeta">Sujeta</option></select></label>
    {tipo === "sujeta" && <label>IVA % <input type="number" min="0" max="100" value={iva} onChange={e => setIva(Number(e.target.value))} /></label>}
    <label>Retención efectivamente practicada (€) <input type="number" min="0" step="0.01" value={retencion} onChange={e => setRetencion(e.target.value)} /></label>
    <button type="button" disabled={pending || retencion === ""} onClick={() => run(() => callAction(setPaymentFiscalAction, paymentId, patientId, tipo, iva, Number(retencion)))}>Confirmar datos fiscales</button>
    {error && <p role="alert">{error}</p>}
  </details>;
}
