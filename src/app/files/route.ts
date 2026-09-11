import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Descarga de archivos del bucket privado `files` mediante URL firmada.
 * La RLS de Storage decide si el usuario (profesional o paciente) puede acceder:
 * createSignedUrl solo funciona si tiene permiso de lectura sobre el objeto.
 */

/** `<uuid>/<nombre>`, que es la única forma que genera la app. */
const STORAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]+$/i;

/**
 * `no-store` en los cinco handlers que devuelven datos personales: la respuesta
 * es un 307 cuyo `Location` lleva la URL firmada, que es una capacidad portadora
 * válida 60 s. No debe quedar en ninguna caché intermedia.
 */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

export async function GET(req: NextRequest) {
  // Los route handlers NO ejecutan layouts, así que aquí no aplica ninguna
  // guardia de `/pro` o `/app`: hay que comprobar la sesión explícitamente.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("No autorizado", { status: 401, headers: NO_STORE });
  }

  const path = req.nextUrl.searchParams.get("path") ?? "";
  // Validar el formato antes de firmar acota la superficie: sin esto se podía
  // pedir la firma de cualquier ruta del bucket y sondear su existencia.
  if (!STORAGE_PATH.test(path)) {
    return new Response("Ruta no válida", { status: 400, headers: NO_STORE });
  }

  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(path, 60);
  if (error || !data) {
    return new Response("No autorizado", { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(data.signedUrl, { headers: NO_STORE });
}
