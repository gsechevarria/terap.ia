import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SESSION_TYPE } from "@/lib/queries/payments";

/**
 * Liquida una cita marcada como "acudió":
 *  - si el paciente tiene un bono activo con sesiones, consume una (used++);
 *  - si no, crea un pago PENDIENTE con el precio aplicable (paciente o por defecto).
 * Idempotente: no hace nada si ya existe un pago para la cita.
 * NUNCA emite facturas: solo registra el seguimiento del pago.
 */
export async function settleAttendedAppointment(
  appointmentId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("appointment_id", appointmentId)
    .limit(1)
    .maybeSingle();
  if (existing) return; // ya liquidada

  const { data: packs } = await supabase
    .from("session_packs")
    .select("id, total_sessions, used_sessions")
    .eq("patient_id", appt.patient_id)
    .eq("active", true)
    .order("purchased_at", { ascending: true });
  const usable = (packs ?? []).find((p) => p.used_sessions < p.total_sessions);

  if (usable) {
    await supabase
      .from("session_packs")
      .update({ used_sessions: usable.used_sessions + 1 })
      .eq("id", usable.id);
    await supabase.from("payments").insert({
      professional_id: appt.professional_id,
      patient_id: appt.patient_id,
      appointment_id: appointmentId,
      session_pack_id: usable.id,
      amount_cents: 0,
      status: "paid",
      method: "bono",
      note: "Sesión cubierta por bono",
      paid_at: new Date().toISOString(),
    });
    return;
  }

  // Precio del paciente o, en su defecto, tarifa por defecto del profesional.
  let amount: number | null = null;
  let currency = "EUR";
  const { data: price } = await supabase
    .from("payment_settings")
    .select("price_cents, currency")
    .eq("patient_id", appt.patient_id)
    .eq("session_type", DEFAULT_SESSION_TYPE)
    .maybeSingle();
  if (price) {
    amount = price.price_cents;
    currency = price.currency;
  } else {
    const { data: def } = await supabase
      .from("payment_settings")
      .select("price_cents, currency")
      .is("patient_id", null)
      .eq("session_type", DEFAULT_SESSION_TYPE)
      .maybeSingle();
    amount = def?.price_cents ?? 0;
    currency = def?.currency ?? "EUR";
  }

  await supabase.from("payments").insert({
    professional_id: appt.professional_id,
    patient_id: appt.patient_id,
    appointment_id: appointmentId,
    amount_cents: amount,
    currency,
    status: "pending",
  });
}
