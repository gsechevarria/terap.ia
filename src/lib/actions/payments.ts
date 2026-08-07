"use server";

import { revalidatePayments } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";
import { DEFAULT_SESSION_TYPE } from "@/lib/queries/payments";
import { isPaymentMethod } from "@/lib/payment-methods";

const eurosToCents = (euros: number) => Math.round(euros * 100);

/** Precio por sesión del paciente (upsert sobre payment_settings). */
export async function upsertPriceAction(patientId: string, priceEuros: number) {
  const { pro } = await requireOwnedPatient(patientId);
  if (!(priceEuros >= 0)) throw new Error("Precio no válido.");

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
export async function addPackAction(
  patientId: string,
  totalSessions: number,
  priceEuros: number,
) {
  const { pro } = await requireOwnedPatient(patientId);
  if (!(totalSessions > 0)) throw new Error("Nº de sesiones no válido.");
  if (!(priceEuros >= 0)) throw new Error("Precio no válido.");

  const supabase = await createClient();
  const priceCents = eurosToCents(priceEuros);

  const { data: pack, error } = await supabase
    .from("session_packs")
    .insert({
      professional_id: pro.id,
      patient_id: patientId,
      total_sessions: totalSessions,
      used_sessions: 0,
      price_cents: priceCents,
      currency: "EUR",
      active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (priceCents > 0) {
    const { error: payErr } = await supabase.from("payments").insert({
      professional_id: pro.id,
      patient_id: patientId,
      session_pack_id: pack.id,
      amount_cents: priceCents,
      currency: "EUR",
      status: "pending",
      note: `Compra de bono (${totalSessions} sesiones)`,
    });
    if (payErr) throw new Error(payErr.message);
  }

  revalidatePayments(patientId);
}

/** Registra un pago manual (sin vincular a cita), con método opcional. */
export async function registerPaymentAction(
  patientId: string,
  amountEuros: number,
  status: "paid" | "pending",
  method?: string | null,
) {
  const { pro } = await requireOwnedPatient(patientId);
  if (!(amountEuros >= 0)) throw new Error("Importe no válido.");

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
export async function setPaymentMethodAction(
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
export async function setPaymentStatusAction(
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

export async function deletePaymentAction(paymentId: string, patientId: string) {
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
