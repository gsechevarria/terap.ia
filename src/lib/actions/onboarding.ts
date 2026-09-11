"use server";
import { runAction } from "@/lib/action-server";

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
async function completeOnboardingActionImpl(token: string, templateId: string, contentHash: string): Promise<Result> {
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

  const { error } = await supabase.rpc("complete_onboarding", {
    p_token: token, p_template_id: templateId, p_content_hash: contentHash,
  });
  if (error) return { ok: false, error: invitationError(error) };
  return { ok: true };
}

export async function completeOnboardingAction(...args: Parameters<typeof completeOnboardingActionImpl>) { return runAction(() => completeOnboardingActionImpl(...args)); }
