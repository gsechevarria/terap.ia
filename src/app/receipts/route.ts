import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Descarga de justificantes de gasto del bucket privado `receipts` mediante URL
 * firmada. La RLS de Storage decide: createSignedUrl solo funciona si el
 * profesional es dueño de la ruta (<professionalId>/<archivo>).
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new Response("Falta path", { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60);
  if (error || !data) return new Response("No autorizado", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
