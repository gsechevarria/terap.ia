import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente con `service_role`. SALTA LA RLS ENTERA.
 *
 * `server-only` no es decorativo: si alguien lo importara desde un componente
 * cliente, el build FALLA en vez de mandar la clave al navegador.
 *
 * Solo debe usarse donde la RLS no puede llegar y la autorización ya está
 * comprobada por otra vía: hoy, la cola de correo (`email_deliveries`, sin
 * políticas a propósito) y el alta del primer administrador por script.
 *
 * NUNCA para leer o escribir datos clínicos en nombre de un usuario: eso va
 * por el cliente de sesión de `supabase/server.ts`, que es el que respeta la
 * RLS y por tanto el aislamiento entre organizaciones.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente administrativo.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
