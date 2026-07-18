import { createClient } from "@/lib/supabase/server";

export type EmergencyLink = {
  id: string;
  label: string;
  phone: string | null;
  url: string | null;
  description: string | null;
};

/**
 * Enlaces de emergencia visibles para el usuario actual: globales (024/112) +
 * los del profesional (según RLS).
 */
export async function getEmergencyLinks(): Promise<EmergencyLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emergency_links")
    .select("id, label, phone, url, description")
    .order("sort_order", { ascending: true });
  return data ?? [];
}
