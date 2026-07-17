import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierre de sesión. Se invoca desde un <form method="post">. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 fuerza un GET tras el POST del formulario.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
