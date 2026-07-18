// =============================================================================
// Test de analítica (Sesión 9) contra Supabase real: siembra datos y verifica
// que el profesional puede leer (RLS) lo que alimenta el panel y que los
// agregados cuadran (activos/archivados, no-shows, ocupación, ingresos, escalas).
//
// Ejecutar:  npm run test:analytics
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Faltan variables en .env.local.");
  process.exit(1);
}
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const rnd = Math.random().toString(36).slice(2, 8);
const PW = `An-${rnd}-${Date.now()}`;
const createdUserIds = [];
async function makeUser(tag, role) {
  const email = `an-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { role, full_name: `An ${tag}` } });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}
async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}
function daysAgo(n) { return new Date(Date.now() - n * 86400e3); }

async function main() {
  console.log("\n== Siembra ==");
  const uProf = await makeUser("prof", "professional");
  const { data: prof } = await admin.from("professionals").select("id").eq("user_id", uProf.id).single();

  const { data: p1 } = await admin.from("patients").insert({ professional_id: prof.id, full_name: "Activo", status: "active" }).select("id").single();
  await admin.from("patients").insert({ professional_id: prof.id, full_name: "Archivado", status: "archived" });

  // 3 citas con asistencia distinta, dentro de la ventana de 8 semanas.
  const mk = (d, att) => ({ professional_id: prof.id, patient_id: p1.id, starts_at: d.toISOString(), ends_at: new Date(d.getTime() + 50 * 60000).toISOString(), status: "confirmed", attendance: att });
  await admin.from("appointments").insert([
    mk(daysAgo(2), "attended"),
    mk(daysAgo(9), "no_show"),
    mk(daysAgo(16), "late_cancel"),
  ]);

  await admin.from("payments").insert({ professional_id: prof.id, patient_id: p1.id, amount_cents: 6000, status: "paid", paid_at: new Date().toISOString() });

  const { data: phq9 } = await admin.from("scales").select("id").eq("code", "PHQ-9").single();
  const { data: asg } = await admin.from("scale_assignments").insert({ professional_id: prof.id, patient_id: p1.id, scale_id: phq9.id, assignment_type: "recurring", recurrence_interval_days: 14, active: true }).select("id").single();
  await admin.from("scale_responses").insert([
    { assignment_id: asg.id, patient_id: p1.id, scale_id: phq9.id, answers: { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 0 } },
    { assignment_id: asg.id, patient_id: p1.id, scale_id: phq9.id, answers: { 1: 1, 2: 1, 3: 0, 4: 1, 5: 0, 6: 0, 7: 1, 8: 0, 9: 0 } },
  ]);

  const a = await signIn(uProf.email);

  console.log("\n== Pacientes activos / archivados ==");
  {
    const { data } = await a.from("patients").select("status").eq("professional_id", prof.id);
    const active = (data ?? []).filter((r) => r.status === "active").length;
    const archived = (data ?? []).filter((r) => r.status === "archived").length;
    check("1 activo / 1 archivado", active === 1 && archived === 1, `active=${active} archived=${archived}`);
  }

  console.log("\n== No-shows y ocupación ==");
  {
    const { data } = await a.from("appointments").select("starts_at, status, attendance").eq("professional_id", prof.id);
    const rows = data ?? [];
    const attended = rows.filter((r) => r.attendance === "attended").length;
    const noShow = rows.filter((r) => r.attendance === "no_show").length;
    const late = rows.filter((r) => r.attendance === "late_cancel").length;
    const total = attended + noShow + late;
    check("asistencia: 1 acudió / 1 no-show / 1 tarde", attended === 1 && noShow === 1 && late === 1);
    check("tasa de no-show = 33%", total === 3 && Math.round((noShow / total) * 100) === 33);
    const since = daysAgo(56);
    const occ = rows.filter((r) => r.status !== "cancelled" && new Date(r.starts_at) >= since).length;
    check("ocupación (8 sem.) = 3 citas", occ === 3, `occ=${occ}`);
  }

  console.log("\n== Ingresos ==");
  {
    const { data } = await a.from("payments").select("amount_cents, status").eq("professional_id", prof.id);
    const paid = (data ?? []).filter((r) => r.status === "paid").reduce((s, r) => s + r.amount_cents, 0);
    check("ingresos cobrados = 60,00 €", paid === 6000, `paid=${paid}`);
  }

  console.log("\n== Escalas (agregado visible por el profesional) ==");
  {
    const { data } = await a.from("scale_responses").select("score").eq("patient_id", p1.id);
    const rows = data ?? [];
    const scored = rows.filter((r) => r.score != null);
    check("el profesional ve 2 respuestas puntuadas", scored.length === 2, `n=${scored.length}`);
  }
}

async function cleanup() {
  console.log("\n== Limpieza ==");
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`  usuarios de prueba eliminados: ${createdUserIds.length}`);
}

try { await main(); }
catch (e) { failures.push(`excepción: ${e.message}`); console.error("\nERROR:", e.message); }
finally { await cleanup(); }

console.log(`\nResultado: ${passed} OK, ${failures.length} fallos`);
if (failures.length) { failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
console.log("Analítica verificada ✅");
