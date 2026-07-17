"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_BODY, CONSENT_VERSION } from "@/lib/consent";

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

  // 2) Registrar el consentimiento (si no existe ya).
  const { data: existing } = await supabase
    .from("consents")
    .select("id")
    .eq("patient_id", patient.id)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const hash = createHash("sha256").update(CONSENT_BODY).digest("hex");
    const { error } = await supabase.from("consents").insert({
      professional_id: patient.professional_id,
      patient_id: patient.id,
      template_id: null,
      template_version: CONSENT_VERSION,
      accepted: true,
      content_hash: hash,
      signed_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
