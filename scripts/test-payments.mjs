// =============================================================================
// Test del seguimiento de pagos (Sesión 6) contra Supabase real:
//   precio por paciente -> bono con consumo -> pago pendiente/pagado ->
//   deuda del paciente -> aislamiento. SIN facturación.
//
// Ejecutar:  npm run test:payments
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
const PW = `Pay-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `pay-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `Pay ${tag}` },
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
  const uA = await makeUser("profA", "professional");
  const { data: profA } = await admin.from("professionals").select("id").eq("user_id", uA.id).single();
  const uB = await makeUser("profB", "professional");
  const { data: profB } = await admin.from("professionals").select("id").eq("user_id", uB.id).single();
  const { data: patient } = await admin
    .from("patients").insert({ professional_id: profA.id, full_name: "Paciente Pagos", status: "active" })
    .select("id").single();
  const uPat = await makeUser("pat", "patient");
  await admin.from("patients").update({ user_id: uPat.id }).eq("id", patient.id);

  const a = await signIn(uA.email);
  const b = await signIn(uB.email);
  const p = await signIn(uPat.email);

  console.log("\n== Precio por sesión (upsert) ==");
  {
    const row = { professional_id: profA.id, patient_id: patient.id, session_type: "individual", price_cents: 6000, currency: "EUR" };
    const { error } = await a.from("payment_settings").upsert(row, { onConflict: "professional_id,patient_id,session_type" });
    check("fijar precio", !error, error?.message);
    await a.from("payment_settings").upsert({ ...row, price_cents: 7000 }, { onConflict: "professional_id,patient_id,session_type" });
    const { data } = await a.from("payment_settings").select("price_cents").eq("patient_id", patient.id);
    check("upsert no duplica y actualiza a 7000", (data ?? []).length === 1 && data[0].price_cents === 7000);
  }

  console.log("\n== Bono con consumo ==");
  const { data: pack } = await a
    .from("session_packs")
    .insert({ professional_id: profA.id, patient_id: patient.id, total_sessions: 5, used_sessions: 0, price_cents: 25000 })
    .select("id").single();
  check("crear bono de 5", !!pack?.id);
  {
    const { error } = await a.from("session_packs").update({ used_sessions: 1 }).eq("id", pack.id);
    check("consumir una sesión del bono", !error, error?.message);
    const { data } = await p.from("session_packs").select("total_sessions, used_sessions");
    const remaining = (data ?? []).reduce((s, r) => s + (r.total_sessions - r.used_sessions), 0);
    check("el paciente ve 4 sesiones de bono", remaining === 4, `remaining=${remaining}`);
  }

  console.log("\n== Pago pendiente -> pagado ==");
  const { data: pay } = await a
    .from("payments")
    .insert({ professional_id: profA.id, patient_id: patient.id, amount_cents: 6000, currency: "EUR", status: "pending" })
    .select("id").single();
  check("registrar pago pendiente", !!pay?.id);
  {
    const { data } = await p.from("payments").select("amount_cents").eq("status", "pending");
    const debt = (data ?? []).reduce((s, r) => s + r.amount_cents, 0);
    check("el paciente ve 60,00 € de deuda", debt === 6000, `debt=${debt}`);
  }
  {
    await a.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", pay.id);
    const { data } = await p.from("payments").select("amount_cents").eq("status", "pending");
    const debt = (data ?? []).reduce((s, r) => s + r.amount_cents, 0);
    check("tras pagar, la deuda del paciente es 0", debt === 0);
  }

  console.log("\n== Aislamiento ==");
  {
    const { error } = await b
      .from("payments")
      .insert({ professional_id: profB.id, patient_id: patient.id, amount_cents: 5000, status: "pending" });
    check("profesional B NO puede crear pagos del paciente de A", !!error, error ? "" : "no dio error");
  }
  {
    const { error } = await p
      .from("payments")
      .insert({ professional_id: profA.id, patient_id: patient.id, amount_cents: 100, status: "paid" });
    check("el paciente NO puede crear pagos", !!error, error ? "" : "no dio error");
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
console.log("Seguimiento de pagos verificado ✅");
