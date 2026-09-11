"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePayments } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";
import { DEFAULT_SESSION_TYPE } from "@/lib/queries/payments";
import { isPaymentMethod } from "@/lib/payment-methods";

const eurosToCents = (euros: number) => Math.round(euros * 100);

/** Precio por sesión del paciente (upsert sobre payment_settings). */
async function upsertPriceActionImpl(patientId: string, priceEuros: number) {
  const { pro } = await requireOwnedPatient(patientId);
  if (!(Number.isFinite(priceEuros) && priceEuros >= 0 && priceEuros <= 21474836.47)) throw new ActionInputError("Precio no válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("payment_settings").upsert(
    {
      professional_id: pro.id,
      patient_id: patientId,
      session_type: DEFAULT_SESSION_TYPE,
      price_cents: eurosToCents(priceEuros),
      currency: "EUR",
    },
    { onConflict: "professional_id,patient_id,session_type" },
  );
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

/**
 * Añade un bono (pack de sesiones) al paciente y registra su cobro.
 *
 * El precio se guardaba SOLO en `session_packs.price_cents` y no generaba
 * ninguna fila en `payments`. Como la vista fiscal deriva de `payments`, y el
 * consumo del bono se registra a 0 €, un bono de 10 sesiones vendido por 500 €
 * aparecía como 10 filas de 0 €: el libro de ingresos, `ingresosTotales`, el
 * rendimiento neto y los cuatro pagos fraccionados del modelo 130 se dejaban
 * los 500 € fuera. También faltaba en la analítica de ingresos.
 *
 * Se registra como PENDIENTE: el profesional lo marca como cobrado cuando
 * efectivamente lo cobre, igual que cualquier otro pago.
 */
async function addPackActionImpl(patientId: string, totalSessions: number, priceEuros: number, requestId: string = crypto.randomUUID()) {
  await requireOwnedPatient(patientId);
  if (!Number.isInteger(totalSessions) || totalSessions < 1 || totalSessions > 1000) throw new ActionInputError("Número de sesiones no válido.");
  if (!Number.isFinite(priceEuros) || priceEuros < 0 || priceEuros > 21474836.47) throw new ActionInputError("Precio no válido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_session_pack", {
    p_patient_id: patientId, p_total_sessions: totalSessions,
    p_price_cents: eurosToCents(priceEuros), p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

/** Registra un pago manual (sin vincular a cita), con método opcional. */
async function registerPaymentActionImpl(
  patientId: string,
  amountEuros: number,
  status: "paid" | "pending",
  method?: string | null,
) {
  const { pro } = await requireOwnedPatient(patientId);
  if (!(Number.isFinite(amountEuros) && amountEuros >= 0 && amountEuros <= 21474836.47)) throw new ActionInputError("Importe no válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    professional_id: pro.id,
    patient_id: patientId,
    amount_cents: eurosToCents(amountEuros),
    currency: "EUR",
    status,
    method: method && isPaymentMethod(method) ? method : null,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

/** Fija/cambia el método de pago de un registro (transferencia/bizum/efectivo). */
async function setPaymentMethodActionImpl(
  paymentId: string,
  patientId: string,
  method: string | null,
) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ method: method && isPaymentMethod(method) ? method : null })
    .eq("id", paymentId)
    .eq("patient_id", patientId)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

/** Cambia el estado de un pago (pagado/pendiente). */
async function setPaymentStatusActionImpl(
  paymentId: string,
  patientId: string,
  status: "paid" | "pending",
) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId)
    .eq("patient_id", patientId)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

async function deletePaymentActionImpl(paymentId: string, patientId: string) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("patient_id", patientId)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

async function setPaymentFiscalActionImpl(paymentId: string, patientId: string, tipo: "exenta" | "sujeta", iva: number, retencionEuros: number) {
  await requireOwnedPatient(patientId);
  if (!Number.isInteger(iva) || iva < 0 || iva > 100 || !Number.isFinite(retencionEuros) || retencionEuros < 0) throw new ActionInputError("Datos fiscales no válidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_payment_fiscal", { p_id: paymentId, p_tipo: tipo, p_iva: iva, p_retencion_cents: eurosToCents(retencionEuros) });
  if (error) throw new Error(error.message);
  revalidatePayments(patientId);
}

export async function upsertPriceAction(...args: Parameters<typeof upsertPriceActionImpl>) { return runAction(() => upsertPriceActionImpl(...args)); }

export async function addPackAction(...args: Parameters<typeof addPackActionImpl>) { return runAction(() => addPackActionImpl(...args)); }

export async function registerPaymentAction(...args: Parameters<typeof registerPaymentActionImpl>) { return runAction(() => registerPaymentActionImpl(...args)); }

export async function setPaymentMethodAction(...args: Parameters<typeof setPaymentMethodActionImpl>) { return runAction(() => setPaymentMethodActionImpl(...args)); }

export async function setPaymentStatusAction(...args: Parameters<typeof setPaymentStatusActionImpl>) { return runAction(() => setPaymentStatusActionImpl(...args)); }

export async function deletePaymentAction(...args: Parameters<typeof deletePaymentActionImpl>) { return runAction(() => deletePaymentActionImpl(...args)); }

export async function setPaymentFiscalAction(...args: Parameters<typeof setPaymentFiscalActionImpl>) { return runAction(() => setPaymentFiscalActionImpl(...args)); }

export async function setPackActiveAction(patientId: string, packId: string, active: boolean) {
  return runAction(async () => {
    const { pro } = await requireOwnedPatient(patientId);
    if (typeof active !== "boolean") throw new ActionInputError("Estado de bono no válido.");
    const supabase = await createClient();
    const { data, error } = await supabase.from("session_packs").update({ active }).eq("id", packId).eq("patient_id", patientId).eq("professional_id", pro.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ActionInputError("Bono no encontrado.");
    revalidatePayments(patientId);
  });
}
