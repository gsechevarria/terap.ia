import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check para el monitor externo.
 *
 * Deliberadamente NO revela nada: ni versión, ni nombres de tabla, ni el
 * mensaje del error de la base de datos. Solo si el servicio responde y si
 * puede hablar con Postgres.
 *
 * Devuelve 503 cuando la base de datos no responde, para que un chequeo por
 * código de estado lo detecte sin tener que leer el cuerpo.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  let db = false;

  try {
    const supabase = await createClient();
    // Consulta trivial contra una tabla del catálogo, que es legible por
    // cualquiera y no contiene datos personales.
    const { error } = await supabase
      .from("scales")
      .select("id", { count: "exact", head: true })
      .limit(1);
    db = !error;
    if (error) {
      console.error("[health] la base de datos no responde", {
        code: error.code,
      });
    }
  } catch (e) {
    console.error("[health] excepción al comprobar la base de datos", {
      message: e instanceof Error ? e.message : "desconocido",
    });
  }

  return NextResponse.json(
    { ok: db, db, ts: new Date().toISOString() },
    { status: db ? 200 : 503, headers },
  );
}
