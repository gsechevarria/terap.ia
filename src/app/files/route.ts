import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Descarga de archivos del bucket privado `files` mediante URL firmada.
 * La RLS de Storage decide si el usuario (profesional o paciente) puede acceder:
 * createSignedUrl solo funciona si tiene permiso de lectura sobre el objeto.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new Response("Falta path", { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(path, 60);
  if (error || !data) return new Response("No autorizado", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
