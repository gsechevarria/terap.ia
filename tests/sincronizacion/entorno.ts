/*
 * Entorno de la prueba de sincronización: lee `.env.test`, exige que apunte a
 * un Supabase LOCAL y sustituye lo que solo existe dentro de un servidor Next.
 */
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { clienteActivo, revalidadas } from "./actores";

for (const linea of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(linea);
  if (m) process.env[m[1]!] = m[2]!;
}
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  // Misma regla que scripts/lib/local-only.mjs: esta prueba crea usuarios y
  // escribe datos, y no puede apuntar nunca al proyecto real.
  throw new Error(`La prueba de sincronización solo corre contra Supabase local, no ${url.hostname}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => clienteActivo(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (ruta: string) => {
    revalidadas.add(ruta);
  },
  revalidateTag: () => {},
  unstable_cache: <T,>(fn: T) => fn,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }),
  headers: async () => new Headers({ "user-agent": "vitest-sincronizacion" }),
}));
