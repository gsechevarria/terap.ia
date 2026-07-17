// =============================================================================
// Test del flujo profesional (Sesión 2) contra Supabase real.
// Ejercita las mismas operaciones que el panel: crear paciente, invitar,
// preview de invitación (anónimo), tareas CRUD, notas, archivar/reactivar y
// filtro por etiqueta. Limpia al terminar.
//
// Ejecutar:  npm run test:pro
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
const PW = `Pro-${rnd}-${Date.now()}`;
const createdUserIds = [];

async function makeProfessional(name) {
  const email = `pro-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "professional", full_name: name },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  createdUserIds.push(data.user.id);
  return email;
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
  console.log("\n== Alta de profesional ==");
  const email = await makeProfessional("Dra. Prueba");
  const pro = await signIn(email);
  const { data: profRow } = await pro
    .from("professionals")
    .select("id")
    .single();
  check("trigger creó la fila professionals", !!profRow?.id);
  const proId = profRow.id;

  console.log("\n== Crear y listar paciente ==");
  const { data: patient, error: pErr } = await pro
    .from("patients")
    .insert({
      professional_id: proId,
      full_name: "Ana Ficticia",
      email: "ana@example.com",
      tags: ["ansiedad", "quincenal"],
      status: "active",
    })
    .select("id")
    .single();
  check("crear paciente", !pErr && !!patient?.id, pErr?.message);
  const patientId = patient.id;

  {
    const { data } = await pro.from("patients").select("id").eq("professional_id", proId);
    check("el paciente aparece en la lista", (data ?? []).some((r) => r.id === patientId));
  }
  {
    const { data } = await pro.from("patients").select("id").contains("tags", ["ansiedad"]);
    check("filtro por etiqueta 'ansiedad'", (data ?? []).some((r) => r.id === patientId));
  }

  console.log("\n== Invitación + preview público ==");
  const { data: inv, error: iErr } = await pro
    .from("invitations")
    .insert({ professional_id: proId, patient_id: patientId, email: "ana@example.com" })
    .select("token")
    .single();
  check("crear invitación", !iErr && !!inv?.token, iErr?.message);

  const anon = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: preview } = await anon.rpc("invitation_preview", {
    p_token: inv.token,
  });
  const row = preview?.[0];
  check("preview anónimo: válida", row?.valid === true);
  check("preview anónimo: nombre del profesional", row?.professional_name === "Dra. Prueba");

  console.log("\n== Tareas CRUD ==");
  const { data: task, error: tErr } = await pro
    .from("tasks")
    .insert({ professional_id: proId, patient_id: patientId, title: "Diario esta semana" })
    .select("id")
    .single();
  check("crear tarea", !tErr && !!task?.id, tErr?.message);
  {
    const { error } = await pro.from("tasks").update({ title: "Diario diario" }).eq("id", task.id);
    check("editar tarea", !error, error?.message);
  }
  {
    const { data } = await pro.from("tasks").select("title").eq("id", task.id).single();
    check("la edición persiste", data?.title === "Diario diario");
  }

  console.log("\n== Notas rápidas ==");
  {
    const { error } = await pro
      .from("patient_notes")
      .insert({ professional_id: proId, patient_id: patientId, body: "Primera sesión: buen rapport." });
    check("añadir nota", !error, error?.message);
    const { data } = await pro.from("patient_notes").select("id").eq("patient_id", patientId);
    check("la nota es legible por el profesional", (data ?? []).length === 1);
  }

  console.log("\n== Archivar / reactivar ==");
  {
    const { error } = await pro.from("patients").update({ status: "archived" }).eq("id", patientId);
    check("archivar paciente", !error, error?.message);
    const { data } = await pro.from("patients").select("status").eq("id", patientId).single();
    check("estado = archived (histórico intacto)", data?.status === "archived");
  }
  {
    const { error } = await pro.from("patients").update({ status: "active" }).eq("id", patientId);
    check("reactivar paciente", !error, error?.message);
  }
  {
    // El histórico (tarea/nota) sigue existiendo tras archivar/reactivar.
    const { data: tasks } = await pro.from("tasks").select("id").eq("patient_id", patientId);
    check("la tarea sigue existiendo tras archivar/reactivar", (tasks ?? []).length === 1);
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
console.log("Flujo profesional verificado ✅");
