import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierre de sesión. Se invoca desde un <form method="post">. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const results = await Promise.all([
      supabase.from("push_subscriptions").delete().eq("user_id", user.id),
      supabase.from("device_push_tokens").delete().eq("user_id", user.id),
    ]);
    if (results.some(r => r.error)) return new Response("No se pudieron desvincular las notificaciones. Vuelve a intentar cerrar sesión.", { status: 503 });
  }
  const { error } = await supabase.auth.signOut();
  if (error) return new Response("No se pudo cerrar la sesión.", { status: 503 });
  // 303 fuerza un GET tras el POST del formulario.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
