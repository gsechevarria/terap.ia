import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para componentes de cliente (browser).
 * Usa la anon key pública (NEXT_PUBLIC_*). Nunca la service_role aquí.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
