// =============================================================================
// Test del módulo Contabilidad (Sesión 6) contra Supabase real:
//   configuración fiscal, gastos, bienes de inversión y la vista
//   v_ingresos_fiscales (security_invoker) — aislamiento entre profesionales +
//   que la vista solo muestra ingresos COBRADOS y hereda la RLS de payments.
//
// Requiere que la migración 20260721090001_contabilidad.sql esté aplicada.
// Ejecutar:  npm run test:contabilidad
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Faltan variables en .env.local.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const rnd = Math.random().toString(36).slice(2, 8);
const PW = `Cont-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `cont-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `Cont ${tag}` },
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email) {
  const c = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function main() {
  console.log("\n== Preparación ==");
  // Comprobación temprana: ¿existe la tabla? (migración aplicada)
  const probe = await admin.from("gastos").select("id").limit(1);
  if (probe.error && /does not exist|schema cache/i.test(probe.error.message)) {
    throw new Error(
      "La tabla 'gastos' no existe: aplica la migración con `supabase db push` antes de ejecutar este test.",
    );
  }

  const uA = await makeUser("profA", "professional");
  const { data: profA } = await admin.from("professionals").select("id").eq("user_id", uA.id).single();
  const uB = await makeUser("profB", "professional");
  const { data: patient } = await admin
    .from("patients").insert({ professional_id: profA.id, full_name: "Paciente Cont", status: "active" })
    .select("id").single();
  const uPat = await makeUser("pat", "patient");
  await admin.from("patients").update({ user_id: uPat.id }).eq("id", patient.id);

  const a = await signIn(uA.email);
  const b = await signIn(uB.email);
  const p = await signIn(uPat.email);

  console.log("\n== Configuración fiscal ==");
  {
    const { error } = await a.from("configuracion_fiscal").upsert(
      { professional_id: profA.id, regimen: "estimacion_directa_simplificada", situacion_iva: "exenta", aplica_retencion_default: false },
      { onConflict: "professional_id" },
    );
    check("A guarda su configuración fiscal", !error, error?.message);
    const { data: read } = await a.from("configuracion_fiscal").select("situacion_iva");
    check("A lee su configuración", (read ?? []).length === 1 && read[0].situacion_iva === "exenta");
    const { data: readB } = await b.from("configuracion_fiscal").select("id").eq("professional_id", profA.id);
    check("B NO ve la configuración de A", (readB ?? []).length === 0);
    const { error: insB } = await b.from("configuracion_fiscal").insert({ professional_id: profA.id, regimen: "estimacion_directa_normal", situacion_iva: "sujeta" });
    check("B NO puede crear configuración a nombre de A", !!insB, insB ? "" : "no dio error");
  }

  console.log("\n== Gastos ==");
  {
    const { data: gasto, error } = await a
      .from("gastos")
      .insert({ professional_id: profA.id, fecha: "2026-03-10", categoria_deducible: "software", base_cents: 2900, tipo_iva: 21, cuota_iva_cents: 609, total_cents: 3509, porcentaje_afectacion: 100 })
      .select("id").single();
    check("A registra un gasto", !!gasto?.id, error?.message);
    const { data: readA } = await a.from("gastos").select("id");
    check("A ve su gasto", (readA ?? []).length === 1);
    const { data: readB } = await b.from("gastos").select("id").eq("professional_id", profA.id);
    check("B NO ve los gastos de A", (readB ?? []).length === 0);
    const { error: insB } = await b.from("gastos").insert({ professional_id: profA.id, fecha: "2026-03-10", categoria_deducible: "otros", base_cents: 100, total_cents: 100 });
    check("B NO puede crear gastos a nombre de A", !!insB, insB ? "" : "no dio error");
    // bien de inversión vinculado
    const { error: bErr } = await a.from("bienes_inversion").insert({ professional_id: profA.id, gasto_id: gasto.id, descripcion: "Portátil", fecha_adquisicion: "2026-03-10", valor_adquisicion_cents: 120000, porcentaje_amortizacion: 25, anios_amortizacion: 4 });
    check("A registra un bien de inversión", !bErr, bErr?.message);
    const { data: bB } = await b.from("bienes_inversion").select("id").eq("professional_id", profA.id);
    check("B NO ve los bienes de inversión de A", (bB ?? []).length === 0);
  }

  console.log("\n== Vista v_ingresos_fiscales (security_invoker) ==");
  {
    // Un pago COBRADO y uno PENDIENTE del paciente de A.
    await a.from("payments").insert({ professional_id: profA.id, patient_id: patient.id, amount_cents: 6000, status: "paid", paid_at: new Date().toISOString() });
    await a.from("payments").insert({ professional_id: profA.id, patient_id: patient.id, amount_cents: 6000, status: "pending" });

    const { data: ingA } = await a.from("v_ingresos_fiscales").select("total_cents, tipo_operacion");
    check("A ve 1 ingreso fiscal (solo el cobrado)", (ingA ?? []).length === 1, `n=${(ingA ?? []).length}`);
    check("el ingreso figura como exento (config de A)", (ingA ?? [])[0]?.tipo_operacion === "exenta");

    const { data: ingB } = await b.from("v_ingresos_fiscales").select("id").eq("professional_id", profA.id);
    check("B NO ve los ingresos de A (RLS heredada por la vista)", (ingB ?? []).length === 0);

    const { data: ingP } = await p.from("v_ingresos_fiscales").select("id");
    check("el paciente ve su propio ingreso (RLS de payments)", (ingP ?? []).length === 1, `n=${(ingP ?? []).length}`);
  }
}

async function cleanup() {
  console.log("\n== Limpieza ==");
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`  usuarios de prueba eliminados: ${createdUserIds.length}`);
}

try {
  await main();
} catch (e) {
  failures.push(`excepción: ${e.message}`);
  console.error("\nERROR:", e.message);
} finally {
  await cleanup();
}

console.log(`\nResultado: ${passed} OK, ${failures.length} fallos`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("Contabilidad verificada ✅");
