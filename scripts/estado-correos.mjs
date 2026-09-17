/**
 * Qué ha pasado con los correos de invitación.
 *
 *   npm run correos            # los 20 últimos intentos
 *   npm run correos -- 50      # los 50 últimos
 *
 * `email_deliveries` no tiene políticas de RLS a propósito —quién ha sido
 * invitado no es algo que deba poder leerse con la clave pública—, así que la
 * única forma de consultarla es esta, con `service_role`.
 *
 * Los cuatro estados significan cosas distintas y conviene no confundirlos:
 *
 *   no_provider  No hay credenciales configuradas. NO se intentó enviar nada.
 *                La invitación existe igual y su enlace sirve.
 *   sent         El PROVEEDOR aceptó el mensaje. NO es acuse de entrega ni de
 *                lectura: puede rebotar después.
 *   failed       El proveedor lo rechazó, o no se pudo contactar con él.
 *                El motivo va en la columna `error`.
 *   pending      Creado y sin intentar todavía.
 */
import { createClient } from "@supabase/supabase-js";
import { exigirEntorno } from "./lib/entorno.mjs";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } =
  exigirEntorno(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const db = createClient(url, key, { auth: { persistSession: false } });

const limite = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 20);

const { data, error } = await db
  .from("email_deliveries")
  .select("created_at, template, status, to_email, provider_id, error")
  .order("created_at", { ascending: false })
  .limit(limite);

if (error) {
  console.error(`No se ha podido leer email_deliveries: ${error.message}`);
  process.exit(1);
}

// Sin `process.exit()`: forzar la salida desde dentro de un `await` deja un
// "Assertion failed ... UV_HANDLE_CLOSING" en Windows. Se deja terminar solo.
if (!data.length) {
  console.log("\nNo hay ningún intento de envío registrado todavía.\n");
  console.log("Se registra una fila cada vez que se emite una invitación,");
  console.log("aunque no haya proveedor configurado. Si esto está vacío es que");
  console.log("aún no se ha emitido ninguna.\n");
} else {

const SIGNIFICA = {
  no_provider: "sin credenciales: no se intentó enviar",
  sent: "el proveedor lo aceptó (no es acuse de entrega)",
  failed: "rechazado o sin contacto con el proveedor",
  pending: "creado, sin intentar",
};

console.log(`\n=== Últimos ${data.length} intentos de envío ===\n`);

const fecha = (iso) =>
  new Date(iso).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

for (const fila of data) {
  console.log(
    `  ${fecha(fila.created_at)}  ${fila.status.padEnd(12)} ${fila.to_email}`,
  );
  console.log(`      plantilla: ${fila.template}`);
  if (fila.provider_id) console.log(`      id del proveedor: ${fila.provider_id}`);
  if (fila.error) console.log(`      motivo: ${fila.error}`);
}

const porEstado = data.reduce((acc, f) => {
  acc[f.status] = (acc[f.status] ?? 0) + 1;
  return acc;
}, {});

console.log("\n--- Resumen ---\n");
for (const [estado, n] of Object.entries(porEstado).sort()) {
  console.log(`  ${String(n).padStart(3)} · ${estado.padEnd(12)} ${SIGNIFICA[estado] ?? ""}`);
}

if (porEstado.no_provider) {
  console.log(
    "\n  Hay envíos sin proveedor. Si ya configuraste RESEND_API_KEY y",
  );
  console.log(
    "  EMAIL_FROM en Vercel, comprueba que hiciste REDEPLOY después: las",
  );
  console.log("  variables solo se aplican a despliegues nuevos.");
}
if (porEstado.failed) {
  console.log(
    "\n  Hay envíos fallidos. El motivo más común con Resend es enviar desde",
  );
  console.log(
    "  un dominio sin verificar, o usar onboarding@resend.dev hacia una",
  );
  console.log("  dirección que no es la de tu propia cuenta de Resend.");
}
console.log("");
}
