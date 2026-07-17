"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";

/** Genera una invitación (token de un solo uso) para el paciente. */
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

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      professional_id: pro.id,
      patient_id: patientId,
      email: patient?.email ?? null,
    })
    .select("token, expires_at")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/pro/patients/${patientId}`);
  return { token: data.token, expiresAt: data.expires_at };
}
