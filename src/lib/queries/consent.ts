import { checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
export async function hasSignedConsent(_patientId?: string): Promise<boolean> {
  void _patientId;
  const supabase = await createClient();
  const { data } = await checked(supabase.rpc("has_current_consent"));
  return data === true;
}
