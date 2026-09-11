import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, homePathForRole } from "@/lib/auth/roles";

/**
 * Destino del enlace mágico / verificación de email.
 * Soporta ambos formatos que Supabase puede enviar:
 *  - Flujo PKCE: ?code=...            → exchangeCodeForSession
 *  - Plantilla token_hash: ?token_hash=...&type=... → verifyOtp
 * Tras verificar, redirige a la home según el rol del usuario.
 */

/**
 * Valida el `?next=` contra una lista blanca de rutas internas.
 *
 * Sin esto había redirección abierta: `new URL("https://evil.tld/x", base)`
 * devuelve el destino externo íntegro, y `//evil.tld` también. Era explotable
 * porque `emailRedirectTo` se construye en el cliente: el atacante pedía su
 * propio enlace mágico con `?next=https://evil.tld`, pasaba la allow-list de
 * Supabase porque el host sí era el legítimo, y difundía una URL alojada en el
 * dominio real de terap.ia que verificaba bien y aterrizaba en su web — con la
 * víctima, además, con la sesión del atacante ya iniciada.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }
  const ALLOW = ["/app", "/pro", "/account/password", "/onboarding/"];
  return ALLOW.some((p) => raw === p || raw.startsWith(p)) ? raw : null;
}
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/login?error=enlace-invalido", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user);
  const dest = safeNext(next) ?? (role ? homePathForRole(role) : "/login");
  return NextResponse.redirect(new URL(dest, request.url));
}
