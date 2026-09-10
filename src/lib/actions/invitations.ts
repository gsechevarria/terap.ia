"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";

/**
 * Genera una invitación (token de un solo uso) para el paciente. El token en
 * claro (256 bits) se genera aquí y se devuelve UNA vez para construir el
 * enlace; en BD solo se guarda su SHA-256 (ver 20260725100001). No hay forma de
 * recuperar el enlace más tarde: si se pierde, se regenera.
 *
 * `requireOwnedPatient` es la corrección de seguridad: antes bastaba con estar
 * autenticado como profesional cualquiera y pasar el UUID de un paciente ajeno.
 * La política `invitations_all_by_professional` solo validaba
 * `professional_id` —el del propio atacante, luego siempre pasaba— y la FK solo
 * exige que la fila exista. Con el token en claro en la respuesta, se canjeaba
 * desde otra cuenta y `accept_invitation` reasignaba `patients.user_id`: el
 * paciente legítimo perdía el acceso a su ficha.
 */
async function createInvitationActionImpl(
  patientId: string,
): Promise<{ token: string; expiresAt: string }> {
  const { patient } = await requireOwnedPatient(patientId);

  // `accept_invitation` exige que el correo de la invitación coincida con el de
  // la cuenta que la canjea, así que sin correo la invitación sería inservible.
  if (!patient.email) {
    throw new ActionInputError(
      "Añade el correo del paciente en su ficha antes de invitarle: la invitación solo puede aceptarla esa dirección.",
    );
  }

  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data, error } = await supabase.rpc("issue_invitation", { p_patient_id: patient.id, p_token_hash: tokenHash });
  if (error) throw new Error(error.message);

  revalidatePath(`/pro/patients/${patientId}`);
  return { token, expiresAt: data };
}

export async function createInvitationAction(...args: Parameters<typeof createInvitationActionImpl>) { return runAction(() => createInvitationActionImpl(...args)); }
