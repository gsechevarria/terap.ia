// =============================================================================
// Test del alta del paciente (Sesión 3) contra Supabase real:
//   aceptar invitación -> vincular cuenta -> firmar consentimiento ->
//   completar una tarea. Verifica también el token de un solo uso.
//
// Ejecutar:  npm run test:onboarding
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
const PW = `Onb-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `onb-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role, full_name: `Onb ${tag}` },
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
  console.log("\n== Preparación (profesional, paciente sin vincular, invitación) ==");
  const uProf = await makeUser("prof", "professional");
  const { data: prof } = await admin
    .from("professionals")
    .select("id")
    .eq("user_id", uProf.id)
    .single();

  const { data: patient } = await admin
    .from("patients")
    .insert({ professional_id: prof.id, full_name: "Paciente Ficticio", status: "active" })
    .select("id")
    .single();

  const { data: inv } = await admin
    .from("invitations")
    .insert({ professional_id: prof.id, patient_id: patient.id })
    .select("token")
    .single();
  check("invitación creada con token", !!inv?.token);

  const { data: task } = await admin
    .from("tasks")
    .insert({ professional_id: prof.id, patient_id: patient.id, title: "Respira 5 min" })
    .select("id")
    .single();

  // Paciente: cuenta creada pero AÚN NO vinculada.
  const uPat = await makeUser("pat", "patient");
  const pat = await signIn(uPat.email);

  console.log("\n== Aceptar invitación (vincular cuenta) ==");
  {
    const { error } = await pat.rpc("accept_invitation", { p_token: inv.token });
    check("accept_invitation ejecutable por el paciente", !error, error?.message);
  }
  {
    const { data } = await pat.from("patients").select("id, user_id").maybeSingle();
    check("la cuenta queda vinculada al paciente", data?.id === patient.id && data?.user_id === uPat.id);
  }

  console.log("\n== Firmar consentimiento ==");
  {
    const { error } = await pat.from("consents").insert({
      professional_id: prof.id,
      patient_id: patient.id,
      accepted: true,
      content_hash: "hash-de-prueba",
      signed_at: new Date().toISOString(),
    });
    check("el paciente firma el consentimiento", !error, error?.message);
  }

  console.log("\n== Completar una tarea ==");
  {
    const { data } = await pat.from("tasks").select("id").eq("id", task.id);
    check("el paciente ve la tarea asignada", (data ?? []).length === 1);
  }
  {
    const { error } = await pat.from("task_completions").insert({
      task_id: task.id,
      patient_id: patient.id,
      response_text: "Hecho, me ayudó.",
    });
    check("el paciente completa la tarea", !error, error?.message);
    const { data } = await pat.from("task_completions").select("id").eq("task_id", task.id);
    check("la realización queda registrada", (data ?? []).length === 1);
  }

  console.log("\n== Token de un solo uso ==");
  {
    const { error } = await pat.rpc("accept_invitation", { p_token: inv.token });
    check("reutilizar el token falla", !!error, error ? "" : "no dio error");
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
console.log("Alta del paciente verificada ✅");
