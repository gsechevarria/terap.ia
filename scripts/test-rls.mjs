// =============================================================================
// Test de RLS multi-tenant para terap.ia (Sesión 1)
//
// Verifica que:
//   - El profesional A NO puede leer datos del profesional B (y viceversa).
//   - Un paciente NO puede leer datos de otro paciente.
//   - Un profesional NO puede escribir sobre pacientes que no son suyos.
//   - Opt-in de escalas: sin assignment activo el paciente no puede responder.
//   - El trigger de puntuación calcula score/severity/flagged.
//
// Requiere (en .env.local, NO se versiona):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY        (clave publishable)
//   SUPABASE_SERVICE_ROLE_KEY            (clave secreta; solo para setup del test)
//
// Ejecutar:  npm run test:rls
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "Faltan variables. Necesito NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- utilidades ------------------------------------------------------------
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
const PW = `Test-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `rls-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `RLS ${tag}` },
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(email) {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PW,
  });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return client;
}

async function main() {
  console.log("\n== Preparando datos de prueba (service_role) ==");

  // Dos profesionales (el trigger handle_new_user crea su fila professionals).
  const uProfA = await makeUser("profA", "professional");
  const uProfB = await makeUser("profB", "professional");

  const { data: profA } = await admin
    .from("professionals")
    .select("id")
    .eq("user_id", uProfA.id)
    .single();
  const { data: profB } = await admin
    .from("professionals")
    .select("id")
    .eq("user_id", uProfB.id)
    .single();
  check("trigger crea professionals de A y B", !!profA?.id && !!profB?.id);

  // Un paciente por profesional, vinculado a su auth.user (simula invitación
  // aceptada).
  const uPatA = await makeUser("patA", "patient");
  const uPatB = await makeUser("patB", "patient");

  const { data: patA } = await admin
    .from("patients")
    .insert({ professional_id: profA.id, full_name: "Paciente A", status: "active" })
    .select("id")
    .single();
  const { data: patB } = await admin
    .from("patients")
    .insert({ professional_id: profB.id, full_name: "Paciente B", status: "active" })
    .select("id")
    .single();
  await admin.from("patients").update({ user_id: uPatA.id }).eq("id", patA.id);
  await admin.from("patients").update({ user_id: uPatB.id }).eq("id", patB.id);

  // Datos de A: una tarea y una entrada de diario.
  const { data: taskA } = await admin
    .from("tasks")
    .insert({
      professional_id: profA.id,
      patient_id: patA.id,
      title: "Tarea de A",
    })
    .select("id")
    .single();
  await admin.from("mood_entries").insert({ patient_id: patA.id, mood_value: 3 });

  const { data: phq9 } = await admin
    .from("scales")
    .select("id")
    .eq("code", "PHQ-9")
    .single();
  check("catálogo PHQ-9 sembrado", !!phq9?.id);

  // Sesiones de usuario reales (RLS activa).
  const cProfA = await signIn(uProfA.email);
  const cProfB = await signIn(uProfB.email);
  const cPatA = await signIn(uPatA.email);
  const cPatB = await signIn(uPatB.email);

  console.log("\n== Aislamiento entre profesionales ==");
  {
    const { data } = await cProfA.from("patients").select("id");
    const ids = (data ?? []).map((r) => r.id);
    check("A ve a su paciente", ids.includes(patA.id));
    check("A NO ve al paciente de B", !ids.includes(patB.id));
  }
  {
    const { data } = await cProfB.from("patients").select("id");
    const ids = (data ?? []).map((r) => r.id);
    check("B NO ve al paciente de A", !ids.includes(patA.id));
  }
  {
    const { data } = await cProfB.from("tasks").select("id").eq("id", taskA.id);
    check("B NO ve la tarea de A", (data ?? []).length === 0);
  }
  {
    // B intenta crear una tarea sobre el paciente de A -> debe fallar (with_check).
    const { error } = await cProfB.from("tasks").insert({
      professional_id: profB.id,
      patient_id: patA.id,
      title: "intrusión",
    });
    check("B NO puede escribir tareas sobre el paciente de A", !!error, error?.message);
  }
  {
    const { error } = await cProfB.from("appointments").insert({
      professional_id: profB.id,
      patient_id: patA.id,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3600e3).toISOString(),
    });
    check("B NO puede crear citas sobre el paciente de A", !!error, error?.message);
  }
  {
    const { error } = await cProfB
      .from("payments")
      .insert({ professional_id: profB.id, patient_id: patA.id, amount_cents: 5000 });
    check("B NO puede crear pagos sobre el paciente de A", !!error, error?.message);
  }
  {
    const { error } = await cProfB.from("scale_assignments").insert({
      professional_id: profB.id,
      patient_id: patA.id,
      scale_id: phq9.id,
    });
    check("B NO puede activar escalas al paciente de A", !!error, error?.message);
  }

  console.log("\n== Aislamiento entre pacientes ==");
  {
    const { data } = await cPatA.from("tasks").select("id");
    const ids = (data ?? []).map((r) => r.id);
    check("Paciente A ve su tarea", ids.includes(taskA.id));
  }
  {
    const { data } = await cPatB.from("tasks").select("id");
    check("Paciente B NO ve tareas de A", (data ?? []).length === 0);
  }
  {
    const { data } = await cPatB.from("mood_entries").select("id");
    check("Paciente B NO ve el diario de A", (data ?? []).length === 0);
  }

  console.log("\n== Guard de vínculo del paciente ==");
  {
    const { error } = await cPatA
      .from("patients")
      .update({ professional_id: profB.id })
      .eq("id", patA.id);
    check("Paciente A NO puede reasignarse a otro profesional", !!error, error?.message);
  }
  {
    const { error } = await cPatA
      .from("patients")
      .update({ status: "archived" })
      .eq("id", patA.id);
    check("Paciente A NO puede cambiar su propio estado", !!error, error?.message);
  }

  console.log("\n== Escalas OPT-IN + trigger de puntuación ==");
  {
    // Sin assignment, el paciente A no puede responder (assignment inexistente).
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const { error } = await cPatA.from("scale_responses").insert({
      assignment_id: fakeId,
      patient_id: patA.id,
      scale_id: phq9.id,
      answers: { 1: 1 },
    });
    check("sin assignment activo, el paciente NO puede responder", !!error, error?.message);
  }
  // El profesional A activa PHQ-9 para su paciente (opt-in).
  const { data: assign, error: assignErr } = await cProfA
    .from("scale_assignments")
    .insert({
      professional_id: profA.id,
      patient_id: patA.id,
      scale_id: phq9.id,
      assignment_type: "one_off",
      active: true,
    })
    .select("id")
    .single();
  check("A puede activar una escala para su paciente", !assignErr && !!assign?.id, assignErr?.message);

  if (assign?.id) {
    // Paciente A responde: suma 1..8 = 12, ítem 9 = 0 -> no flag.
    const answers = { 1: 2, 2: 1, 3: 2, 4: 1, 5: 2, 6: 1, 7: 1, 8: 2, 9: 0 };
    const expected = Object.values(answers).reduce((a, b) => a + b, 0); // 12
    const { data: resp, error: respErr } = await cPatA
      .from("scale_responses")
      .insert({
        assignment_id: assign.id,
        patient_id: patA.id,
        scale_id: phq9.id,
        answers,
      })
      .select("score, severity, flagged")
      .single();
    check("con assignment, el paciente SÍ puede responder", !respErr, respErr?.message);
    check(`el trigger calcula score = ${expected}`, resp?.score === expected, `score=${resp?.score}`);
    check("el trigger asigna severidad", !!resp?.severity, `severity=${resp?.severity}`);
    check("ítem 9 = 0 -> flagged false", resp?.flagged === false);

    // Respuesta con ítem 9 > 0 -> flagged true.
    const { data: resp2 } = await cPatA
      .from("scale_responses")
      .insert({
        assignment_id: assign.id,
        patient_id: patA.id,
        scale_id: phq9.id,
        answers: { 1: 0, 9: 2 },
      })
      .select("flagged")
      .single();
    check("ítem 9 > 0 -> flagged true", resp2?.flagged === true);

    // Paciente B intenta responder usando el assignment de A -> falla.
    const { error: crossErr } = await cPatB.from("scale_responses").insert({
      assignment_id: assign.id,
      patient_id: patB.id,
      scale_id: phq9.id,
      answers: { 1: 1 },
    });
    check("Paciente B NO puede responder el assignment de A", !!crossErr, crossErr?.message);
  }

  console.log("\n== Emergencias (globales visibles para todos) ==");
  {
    const { data } = await cPatA.from("emergency_links").select("phone").is("professional_id", null);
    const phones = (data ?? []).map((r) => r.phone);
    check("el paciente ve los enlaces globales 024/112", phones.includes("024") && phones.includes("112"));
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
  console.log("Fallos:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("Todas las comprobaciones de RLS pasaron ✅");
