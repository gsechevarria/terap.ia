/*
 * Usuarios de la prueba y «quién está actuando ahora».
 *
 * La aplicación crea su cliente de Supabase a partir de las cookies de la
 * petición. Aquí no hay petición: `@/lib/supabase/server` se sustituye por el
 * cliente del actor activo, autenticado de verdad contra el Supabase local
 * (Auth emite el JWT y PostgREST aplica la RLS como en producción).
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Cliente = SupabaseClient<Database>;
export type Actor = { id: string; email: string; db: Cliente };

let activo: Actor | null = null;

export function actuarComo(actor: Actor) {
  activo = actor;
}

export function clienteActivo(): Cliente {
  if (!activo) throw new Error("Ningún actor activo: llama a actuarComo() antes");
  return activo.db;
}

/** Rutas invalidadas con `revalidatePath` desde el último `limpiarRevalidaciones()`. */
export const revalidadas = new Set<string>();
export function limpiarRevalidaciones() {
  revalidadas.clear();
}

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const nuevo = (clave: string): Cliente =>
  createClient<Database>(url(), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export function admin(): Cliente {
  return nuevo(process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Cuenta nueva con sesión real (enlace mágico verificado sin enviar correo). */
export async function nuevoUsuario(rol: "professional" | "patient", nombre: string): Promise<Actor> {
  const email = `sync-${randomUUID()}@example.com`;
  const a = admin();
  const alta = await a.auth.admin.createUser({
    email,
    password: `Ficticio-Aa9!${randomUUID()}`,
    email_confirm: true,
    app_metadata: { role: rol },
    user_metadata: { full_name: nombre },
  });
  if (alta.error || !alta.data.user) throw new Error(alta.error?.message ?? "Sin usuario");
  const enlace = await a.auth.admin.generateLink({ type: "magiclink", email });
  if (enlace.error) throw new Error(enlace.error.message);
  const db = nuevo(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const sesion = await db.auth.verifyOtp({ type: "magiclink", token_hash: enlace.data.properties.hashed_token });
  if (sesion.error) throw new Error(sesion.error.message);
  const user = alta.data.user;
  return { id: user.id, email, db };
}
