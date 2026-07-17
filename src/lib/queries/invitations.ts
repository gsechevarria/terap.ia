import { createClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

/** Invitación pendiente (no aceptada y no caducada) más reciente del paciente. */
export async function getActiveInvitation(
  patientId: string,
): Promise<Invitation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("patient_id", patientId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
