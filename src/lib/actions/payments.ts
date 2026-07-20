"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { DEFAULT_SESSION_TYPE } from "@/lib/queries/payments";
import { isPaymentMethod } from "@/lib/payment-methods";

const eurosToCents = (euros: number) => Math.round(euros * 100);

/** Precio por sesión del paciente (upsert sobre payment_settings). */
export async function upsertPriceAction(patientId: string, priceEuros: number) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
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
  revalidatePath(`/pro/patients/${patientId}`);
}

/** Añade un bono (pack de sesiones) al paciente. */
export async function addPackAction(
  patientId: string,
  totalSessions: number,
  priceEuros: number,
) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
  if (!(totalSessions > 0)) throw new Error("Nº de sesiones no válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("session_packs").insert({
    professional_id: pro.id,
    patient_id: patientId,
    total_sessions: totalSessions,
    used_sessions: 0,
    price_cents: eurosToCents(priceEuros),
    currency: "EUR",
    active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

/** Registra un pago manual (sin vincular a cita), con método opcional. */
export async function registerPaymentAction(
  patientId: string,
  amountEuros: number,
  status: "paid" | "pending",
  method?: string | null,
) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
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
  revalidatePath(`/pro/patients/${patientId}`);
  revalidatePath("/pro/pagos");
}

/** Fija/cambia el método de pago de un registro (transferencia/bizum/efectivo). */
export async function setPaymentMethodAction(
  paymentId: string,
  patientId: string,
  method: string | null,
) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ method: method && isPaymentMethod(method) ? method : null })
    .eq("id", paymentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
  revalidatePath("/pro/pagos");
}

/** Cambia el estado de un pago (pagado/pendiente). */
export async function setPaymentStatusAction(
  paymentId: string,
  patientId: string,
  status: "paid" | "pending",
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
  revalidatePath("/pro/pagos");
}

export async function deletePaymentAction(paymentId: string, patientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
  revalidatePath("/pro/pagos");
}
