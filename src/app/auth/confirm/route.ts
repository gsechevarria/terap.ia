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
  const dest = next ?? (role ? homePathForRole(role) : "/login");
  return NextResponse.redirect(new URL(dest, request.url));
}
