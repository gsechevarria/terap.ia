// =============================================================================
// Test de notificaciones (Sesión 8) contra Supabase real:
//   RLS de push_subscriptions y notification_preferences (cada uno lo suyo),
//   encolado de notificación por el profesional y lectura por el paciente.
//
// Ejecutar:  npm run test:notifications
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
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const rnd = Math.random().toString(36).slice(2, 8);
const PW = `Nt-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeUser(tag, role) {
  const email = `nt-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true, user_metadata: { role, full_name: `Nt ${tag}` },
  });
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

async function main() {
  console.log("\n== Preparación ==");
  const uProf = await makeUser("prof", "professional");
  const { data: prof } = await admin.from("professionals").select("id").eq("user_id", uProf.id).single();
  const { data: patient } = await admin.from("patients").insert({ professional_id: prof.id, full_name: "Pac", status: "active" }).select("id").single();
  const uPatA = await makeUser("patA", "patient");
  await admin.from("patients").update({ user_id: uPatA.id }).eq("id", patient.id);
  const uPatB = await makeUser("patB", "patient");

  const a = await signIn(uProf.email);
  const pA = await signIn(uPatA.email);
  const pB = await signIn(uPatB.email);

  console.log("\n== Suscripciones push (RLS) ==");
  {
    const { error } = await pA.from("push_subscriptions").insert({ user_id: uPatA.id, endpoint: `https://push.test/${rnd}`, p256dh: "k", auth: "a" });
    check("el usuario guarda su suscripción", !error, error?.message);
  }
  {
    const { data } = await pA.from("push_subscriptions").select("id");
    check("ve su suscripción", (data ?? []).length === 1);
  }
  {
    const { data } = await pB.from("push_subscriptions").select("id");
    check("otro usuario NO ve la suscripción", (data ?? []).length === 0);
  }
  {
    const { error } = await pB.from("push_subscriptions").insert({ user_id: uPatA.id, endpoint: `https://push.test/intruso-${rnd}`, p256dh: "k", auth: "a" });
    check("no se puede suscribir en nombre de otro", !!error, error ? "" : "no dio error");
  }

  console.log("\n== Preferencias (RLS) ==");
  {
    const { error } = await pA.from("notification_preferences").upsert({ user_id: uPatA.id, new_task: false });
    check("el usuario guarda sus preferencias", !error, error?.message);
    const { data } = await pA.from("notification_preferences").select("new_task").eq("user_id", uPatA.id).single();
    check("preferencia new_task = false persiste", data?.new_task === false);
  }
  {
    const { data } = await pB.from("notification_preferences").select("user_id").eq("user_id", uPatA.id);
    check("otro usuario NO ve preferencias ajenas", (data ?? []).length === 0);
  }

  console.log("\n== Encolado y lectura ==");
  {
    const { error } = await a.from("notifications").insert({
      user_id: uPatA.id, professional_id: prof.id, patient_id: patient.id,
      channel: "push", type: "new_task", title: "Nueva tarea", body: "…", status: "queued",
    });
    check("el profesional encola una notificación", !error, error?.message);
    const { data } = await pA.from("notifications").select("id").eq("status", "queued");
    check("el paciente ve su notificación encolada", (data ?? []).length >= 1);
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
console.log("Notificaciones verificadas ✅");
