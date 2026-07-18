// =============================================================================
// Test del ciclo de citas (Sesión 5) contra Supabase real:
//   profesional crea cita -> paciente ve/confirma/cancela -> profesional marca
//   asistencia -> notificación al paciente -> bloqueos privados -> aislamiento.
//
// Ejecutar:  npm run test:agenda
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
const PW = `Agd-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `agd-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `Agd ${tag}` },
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

function slot(daysFromNow) {
  const s = new Date(Date.now() + daysFromNow * 86400e3);
  const e = new Date(s.getTime() + 50 * 60000);
  return { starts_at: s.toISOString(), ends_at: e.toISOString() };
}

async function main() {
  console.log("\n== Preparación ==");
  const uProf = await makeUser("profA", "professional");
  const { data: profA } = await admin
    .from("professionals").select("id").eq("user_id", uProf.id).single();
  const uProfB = await makeUser("profB", "professional");
  const { data: profB } = await admin
    .from("professionals").select("id").eq("user_id", uProfB.id).single();

  const { data: patient } = await admin
    .from("patients")
    .insert({ professional_id: profA.id, full_name: "Paciente Agenda", status: "active" })
    .select("id").single();
  const uPat = await makeUser("pat", "patient");
  await admin.from("patients").update({ user_id: uPat.id }).eq("id", patient.id);

  const a = await signIn(uProf.email);
  const b = await signIn(uProfB.email);
  const p = await signIn(uPat.email);

  console.log("\n== Crear citas (profesional) ==");
  const { data: c1, error: e1 } = await a
    .from("appointments")
    .insert({ professional_id: profA.id, patient_id: patient.id, ...slot(1), video_link: "https://meet.example/x" })
    .select("id").single();
  check("crear cita 1", !e1 && !!c1?.id, e1?.message);
  const { data: c2 } = await a
    .from("appointments")
    .insert({ professional_id: profA.id, patient_id: patient.id, ...slot(2) })
    .select("id").single();

  console.log("\n== Paciente ve y responde ==");
  {
    const { data } = await p.from("appointments").select("id");
    const ids = (data ?? []).map((r) => r.id);
    check("el paciente ve sus 2 citas", ids.includes(c1.id) && ids.includes(c2.id));
  }
  {
    const { error } = await p.from("appointments").update({ status: "confirmed" }).eq("id", c1.id);
    check("el paciente confirma la cita 1", !error, error?.message);
    const { data } = await p.from("appointments").select("status").eq("id", c1.id).single();
    check("estado = confirmed", data?.status === "confirmed");
  }
  {
    const { error } = await p.from("appointments").update({ status: "cancelled" }).eq("id", c2.id);
    check("el paciente cancela la cita 2", !error, error?.message);
  }

  console.log("\n== Profesional marca asistencia ==");
  {
    const { error } = await a
      .from("appointments").update({ attendance: "attended", status: "completed" }).eq("id", c1.id);
    check("asistencia = acudió", !error, error?.message);
    const { data } = await a.from("appointments").select("attendance, status").eq("id", c1.id).single();
    check("attendance=attended, status=completed", data?.attendance === "attended" && data?.status === "completed");
  }

  console.log("\n== Notificación al paciente ==");
  {
    const { error } = await a.from("notifications").insert({
      user_id: uPat.id, professional_id: profA.id, patient_id: patient.id,
      channel: "push", type: "appointment_created", title: "Nueva cita",
    });
    check("el profesional encola notificación al paciente", !error, error?.message);
    const { data } = await p.from("notifications").select("id");
    check("el paciente ve su notificación", (data ?? []).length >= 1);
  }

  console.log("\n== Bloqueos privados del profesional ==");
  {
    const { error } = await a.from("agenda_blocks").insert({ professional_id: profA.id, ...slot(5), reason: "Vacaciones" });
    check("el profesional crea un bloqueo", !error, error?.message);
    const { data } = await p.from("agenda_blocks").select("id");
    check("el paciente NO ve los bloqueos", (data ?? []).length === 0);
  }

  console.log("\n== Aislamiento ==");
  {
    const { error } = await b
      .from("appointments")
      .insert({ professional_id: profB.id, patient_id: patient.id, ...slot(3) });
    check("profesional B NO puede crear cita para paciente de A", !!error, error ? "" : "no dio error");
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
console.log("Ciclo de citas verificado ✅");
