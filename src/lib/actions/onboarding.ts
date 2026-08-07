"use server";

import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Traduce los errores de `accept_invitation` a algo que el paciente entienda.
 *
 * Desde 20260807120002 la RPC lanza excepciones que antes no existían (correo
 * que no corresponde, ficha ya vinculada, cuenta ya vinculada). Sin este mapa,
 * el usuario vería el texto crudo de Postgres.
 */
function invitationError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "P0002":
      return "Esta invitación se envió a otra dirección de correo. Entra con el correo en el que la recibiste, o pide a tu profesional que te envíe una nueva.";
    case "P0003":
      return "Tu cuenta ya está vinculada a una ficha de paciente. Si crees que es un error, habla con tu profesional.";
    case "P0004":
      return "Esta ficha ya tiene una cuenta vinculada. Pide a tu profesional que revise la invitación.";
    case "P0001":
      return "El enlace no es válido, ha caducado o ya se ha usado. Pide a tu profesional que te envíe uno nuevo.";
    default:
      return "No hemos podido completar tu alta. Inténtalo de nuevo; si sigue fallando, avisa a tu profesional.";
  }
}

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

  // La comprobación de rol vivía solo en la página, y una server action es un
  // endpoint HTTP: se podía invocar directamente saltándose la página.
  if (getUserRole(user) !== ROLES.PATIENT) {
    return {
      ok: false,
      error: "Esta cuenta no es de paciente, así que no puede aceptar una invitación.",
    };
  }

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
    if (error) return { ok: false, error: invitationError(error) };
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
  if (error) {
    return {
      ok: false,
      error:
        "Tu cuenta ha quedado vinculada, pero no hemos podido registrar el consentimiento. Vuelve a intentarlo.",
    };
  }

  return { ok: true };
}
