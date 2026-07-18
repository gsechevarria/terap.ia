// =============================================================================
// Test del ciclo de escalas opt-in (Sesión 4) contra Supabase real:
//   activar (profesional) -> responder (paciente) -> puntuar/severidad/flag
//   (trigger) -> alerta ítem 9 -> desactivar bloquea nuevas respuestas.
//
// Ejecutar:  npm run test:scales
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
const PW = `Scl-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `scl-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `Scl ${tag}` },
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email) {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn: ${error.message}`);
  return client;
}

async function main() {
  console.log("\n== Preparación ==");
  const uProf = await makeUser("prof", "professional");
  const { data: prof } = await admin
    .from("professionals")
    .select("id")
    .eq("user_id", uProf.id)
    .single();
  const { data: patient } = await admin
    .from("patients")
    .insert({ professional_id: prof.id, full_name: "Paciente Escalas", status: "active" })
    .select("id")
    .single();
  const uPat = await makeUser("pat", "patient");
  await admin.from("patients").update({ user_id: uPat.id }).eq("id", patient.id);

  const { data: phq9 } = await admin
    .from("scales")
    .select("id")
    .eq("code", "PHQ-9")
    .single();

  const prof_c = await signIn(uProf.email);
  const pat_c = await signIn(uPat.email);

  console.log("\n== Opt-in: antes de activar ==");
  {
    const { data } = await pat_c
      .from("scale_assignments")
      .select("id")
      .eq("active", true);
    check("el paciente no ve ninguna escala activa", (data ?? []).length === 0);
  }

  console.log("\n== Profesional activa PHQ-9 ==");
  const { data: assign, error: aErr } = await prof_c
    .from("scale_assignments")
    .insert({
      professional_id: prof.id,
      patient_id: patient.id,
      scale_id: phq9.id,
      assignment_type: "one_off",
      active: true,
    })
    .select("id")
    .single();
  check("activación creada", !aErr && !!assign?.id, aErr?.message);
  {
    const { data } = await pat_c
      .from("scale_assignments")
      .select("id")
      .eq("active", true);
    check("ahora el paciente ve la escala activa", (data ?? []).some((r) => r.id === assign.id));
  }

  console.log("\n== Responder + puntuación por trigger ==");
  {
    const answers = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0, 8: 0, 9: 0 }; // suma 5
    const { data, error } = await pat_c
      .from("scale_responses")
      .insert({ assignment_id: assign.id, patient_id: patient.id, scale_id: phq9.id, answers })
      .select("score, severity, flagged")
      .single();
    check("respuesta enviada", !error, error?.message);
    check("score calculado = 5", data?.score === 5, `score=${data?.score}`);
    check("severidad 'Leve' (5-9)", data?.severity === "Leve", `sev=${data?.severity}`);
    check("ítem 9 = 0 -> sin alerta", data?.flagged === false);
  }

  console.log("\n== Alerta ítem 9 (>0) ==");
  {
    const answers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 2 };
    const { data, error } = await pat_c
      .from("scale_responses")
      .insert({ assignment_id: assign.id, patient_id: patient.id, scale_id: phq9.id, answers })
      .select("flagged")
      .single();
    check("respuesta con ítem 9 > 0 enviada", !error, error?.message);
    check("marca alerta (flagged)", data?.flagged === true);
  }
  {
    const { count } = await prof_c
      .from("scale_responses")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("flagged", true);
    check("el profesional ve 1 alerta", count === 1, `count=${count}`);
  }

  console.log("\n== Desactivar bloquea nuevas respuestas ==");
  {
    await prof_c.from("scale_assignments").update({ active: false }).eq("id", assign.id);
    const { error } = await pat_c
      .from("scale_responses")
      .insert({ assignment_id: assign.id, patient_id: patient.id, scale_id: phq9.id, answers: { 1: 1 } });
    check("sin escala activa, el paciente no puede responder", !!error, error ? "" : "no dio error");
  }

  console.log("\n== Emergencias visibles para el paciente ==");
  {
    const { data } = await pat_c
      .from("emergency_links")
      .select("phone")
      .is("professional_id", null);
    const phones = (data ?? []).map((r) => r.phone);
    check("el paciente ve 024 y 112", phones.includes("024") && phones.includes("112"));
  }
}

async function cleanup() {
  console.log("\n== Limpieza ==");
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
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
console.log("Ciclo de escalas verificado ✅");
