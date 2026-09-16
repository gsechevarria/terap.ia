/**
 * Informe PREVIO a la migración de organizaciones. SOLO LECTURA.
 *
 * No escribe absolutamente nada. Se ejecuta antes de aplicar las migraciones
 * `20260916100001`–`20260916100004` para saber exactamente qué se va a tocar y,
 * sobre todo, si hay algo AMBIGUO que no deba resolverse inventando datos.
 *
 *   node --env-file=.env.local scripts/informe-migracion-organizaciones.mjs
 *
 * Y después de aplicarlas, el mismo script comprueba que las relaciones han
 * quedado como debían:
 *
 *   node --env-file=.env.local scripts/informe-migracion-organizaciones.mjs --verificar
 *
 * Necesita `SUPABASE_SERVICE_ROLE_KEY` porque tiene que ver TODAS las filas,
 * no las de un profesional. Lo ejecuta una persona, nunca el agente.
 */
import { createClient } from "@supabase/supabase-js";
import { exigirEntorno } from "./lib/entorno.mjs";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } =
  exigirEntorno(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const db = createClient(url, key, { auth: { persistSession: false } });
const verificar = process.argv.includes("--verificar");

const contar = async (tabla, filtro = (q) => q) => {
  const { count, error } = await filtro(
    db.from(tabla).select("id", { count: "exact", head: true }),
  );
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return count ?? 0;
};

const linea = (etiqueta, valor) =>
  console.log(`  ${String(etiqueta).padEnd(52, ".")} ${valor}`);

console.log(`\n=== Informe de migración a organizaciones ${verificar ? "(verificación posterior)" : "(previo)"} ===\n`);

// --- Inventario de lo que existe --------------------------------------------
console.log("Inventario");
const profesionales = await contar("professionals");
const pacientes = await contar("patients");
const invitaciones = await contar("invitations");
linea("profesionales", profesionales);
linea("expedientes de paciente", pacientes);
linea("expedientes con cuenta vinculada", await contar("patients", (q) => q.not("user_id", "is", null)));
linea("invitaciones emitidas", invitaciones);

// --- Cuentas de autenticación ------------------------------------------------
// `auth.users` no está en la API REST: se lee por la Admin API, paginando.
let usuarios = [];
for (let pagina = 1; ; pagina++) {
  const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
  if (error) throw new Error(`auth.users: ${error.message}`);
  usuarios = usuarios.concat(data.users);
  if (data.users.length < 1000) break;
}
const porRol = usuarios.reduce((acc, u) => {
  const r = u.app_metadata?.role ?? "(sin rol)";
  acc[r] = (acc[r] ?? 0) + 1;
  return acc;
}, {});
console.log("\nCuentas de autenticación");
linea("total", usuarios.length);
for (const [rol, n] of Object.entries(porRol).sort()) linea(`rol ${rol}`, n);

// --- Casos que NO deben resolverse a ciegas ---------------------------------
console.log("\nCasos ambiguos (si sale algo aquí, NO se migra hasta decidirlo)");

const { data: prosRows } = await db.from("professionals").select("user_id");
const idsProfesional = new Set((prosRows ?? []).map((p) => p.user_id));
const { data: pacRows } = await db.from("patients").select("user_id").not("user_id", "is", null);
const idsPaciente = new Set((pacRows ?? []).map((p) => p.user_id));

const huerfanasProfesional = usuarios.filter(
  (u) => u.app_metadata?.role === "professional" && !idsProfesional.has(u.id),
);
const huerfanasPaciente = usuarios.filter(
  (u) => (u.app_metadata?.role ?? "patient") === "patient" && !idsPaciente.has(u.id),
);

linea("cuentas con rol profesional SIN ficha de profesional", huerfanasProfesional.length);
linea("cuentas de paciente SIN expediente vinculado", huerfanasPaciente.length);

// Estas dos son las que bloquean la migración: no hay forma inequívoca de
// derivar su organización, y el encargo prohíbe inventarla.
if (!verificar) {
  const sinOrganizacion = huerfanasProfesional.length;
  if (sinOrganizacion > 0) {
    console.log(
      "\n  AVISO: hay cuentas con rol profesional sin fila en `professionals`.",
    );
    console.log(
      "  La migración NO las toca: no crea organización para ellas ni les",
    );
    console.log("  asigna ningún expediente. Quedan exactamente como están.");
    for (const u of huerfanasProfesional) console.log(`    · ${u.email ?? u.id}`);
  }
  if (huerfanasPaciente.length > 0) {
    console.log(
      "\n  NOTA: cuentas de paciente sin expediente. Son el residuo conocido de",
    );
    console.log(
      "  invitaciones abiertas con otro correo (ver CLAUDE.md, ago-2026).",
    );
    console.log("  No dan acceso a nada y la migración tampoco las toca.");
  }
}

// --- Lo que la migración va a crear / lo que ha creado ----------------------
if (verificar) {
  console.log("\nVerificación posterior");
  const orgs = await contar("organizations");
  const miembros = await contar("organization_members", (q) => q.eq("status", "active"));
  const asignaciones = await contar("patient_assignments", (q) => q.is("revoked_at", null));
  const sinOrg = await contar("patients", (q) => q.is("organization_id", null));

  linea("organizaciones", orgs);
  linea("membresías activas", miembros);
  linea("asignaciones clínicas vivas", asignaciones);
  linea("expedientes SIN organización (debe ser 0)", sinOrg);

  const problemas = [];
  if (orgs < profesionales) problemas.push("hay menos organizaciones que profesionales");
  if (miembros < profesionales) problemas.push("hay profesionales sin membresía activa");
  if (asignaciones < pacientes) problemas.push("hay expedientes sin asignación viva");
  if (sinOrg > 0) problemas.push("hay expedientes sin organización");

  // Cada expediente debe seguir con SU profesional de siempre.
  const { data: cruces } = await db
    .from("patients")
    .select("id, professional_id, organization_id, patient_assignments(professional_id, role, revoked_at)")
    .limit(2000);
  const descolgados = (cruces ?? []).filter(
    (p) =>
      !(p.patient_assignments ?? []).some(
        (a) => a.professional_id === p.professional_id && a.role === "primary" && !a.revoked_at,
      ),
  );
  linea("expedientes sin su profesional de referencia asignado", descolgados.length);
  if (descolgados.length > 0) problemas.push("hay expedientes cuyo profesional de referencia no está asignado");

  console.log("");
  if (problemas.length === 0) {
    console.log("OK: las relaciones se conservan. Ningún expediente ha cambiado de manos.");
  } else {
    console.log("PROBLEMAS:");
    for (const p of problemas) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
} else {
  console.log("\nLo que hará la migración");
  linea("organizaciones a crear (una por profesional)", profesionales);
  linea("membresías de propietario a crear", profesionales);
  linea("expedientes a adscribir a una organización", pacientes);
  linea("asignaciones clínicas a crear", pacientes);
  console.log(
    "\nNada se borra: ni tablas, ni expedientes, ni cuentas, ni vínculos.",
  );
  console.log(
    "La derivación es inequívoca: `patients.professional_id` es NOT NULL y",
  );
  console.log("cada profesional pasa a tener exactamente una organización.\n");
}
