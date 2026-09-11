import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";

/**
 * Descarga de justificantes de gasto del bucket privado `receipts` mediante URL
 * firmada. La RLS de Storage decide: createSignedUrl solo funciona si el
 * profesional es dueño de la ruta (<professionalId>/<archivo>).
 */

const STORAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]+$/i;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

export async function GET(req: NextRequest) {
  // Este handler vive fuera de `/pro`, pero aunque estuviera dentro los route
  // handlers no ejecutan layouts: la guardia va aquí.
  const pro = await getCurrentProfessional();
  if (!pro) {
    return new Response("No autorizado", { status: 401, headers: NO_STORE });
  }

  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!STORAGE_PATH.test(path)) {
    return new Response("Ruta no válida", { status: 400, headers: NO_STORE });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60);
  if (error || !data) {
    return new Response("No autorizado", { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(data.signedUrl, { headers: NO_STORE });
}
