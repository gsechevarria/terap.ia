"use server";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Completa el alta del paciente: consume la invitación (vincula la cuenta) y
 * registra la firma del consentimiento. Idempotente si se reintenta.
 * Devuelve un resultado (la navegación la hace el cliente).
 */
export async function completeOnboardingAction(token: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  // 1) Vincular la cuenta a la fila patient (si no lo está ya).
  let { data: patient } = await supabase
    .from("patients")
    .select("id, professional_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!patient) {
    const { error } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });
    if (error) return { ok: false, error: error.message };
    const res = await supabase
      .from("patients")
      .select("id, professional_id")
      .eq("user_id", user.id)
      .maybeSingle();
    patient = res.data;
  }
  if (!patient) return { ok: false, error: "No se pudo vincular la cuenta." };

  // 2) Registrar la firma del consentimiento. La RPC (SECURITY DEFINER) resuelve
  //    profesional + plantilla activa y hashea el texto ALMACENADO EN BD, de modo
  //    que el paciente no puede fabricar la evidencia (professional_id, versión,
  //    accepted, hash). Es idempotente: si ya firmó, no duplica.
  const { error } = await supabase.rpc("patient_accept_consent");
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
