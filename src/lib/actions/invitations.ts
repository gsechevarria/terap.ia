"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";

/**
 * Genera una invitación (token de un solo uso) para el paciente. El token en
 * claro (256 bits) se genera aquí y se devuelve UNA vez para construir el
 * enlace; en BD solo se guarda su SHA-256 (ver 20260725100001). No hay forma de
 * recuperar el enlace más tarde: si se pierde, se regenera.
 */
export async function createInvitationAction(
  patientId: string,
): Promise<{ token: string; expiresAt: string }> {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", patientId)
    .maybeSingle();

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      professional_id: pro.id,
      patient_id: patientId,
      email: patient?.email ?? null,
      token_hash: tokenHash,
    })
    .select("expires_at")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/pro/patients/${patientId}`);
  return { token, expiresAt: data.expires_at };
}
