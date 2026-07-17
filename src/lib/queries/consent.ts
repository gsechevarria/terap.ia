import { createClient } from "@/lib/supabase/server";

/** ¿El paciente ya ha firmado un consentimiento? */
export async function hasSignedConsent(patientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("patient_id", patientId)
    .eq("accepted", true)
    .limit(1)
    .maybeSingle();
  return !!data;
}
