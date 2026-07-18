// =============================================================================
// Test de diario + recursos + documentos/Storage (Sesión 7) contra Supabase real:
//   diario (RLS), recursos (por paciente y generales), Storage privado con RLS
//   (subida del profesional, descarga firmada del paciente, aislamiento).
//
// Ejecutar:  npm run test:wellbeing
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
const PW = `Wb-${rnd}-${Date.now()}`;
const createdUserIds = [];
let uploadedPath = null;

async function makeUser(tag, role) {
  const email = `wb-${tag}-${rnd}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true,
    user_metadata: { role, full_name: `Wb ${tag}` },
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
  const uA = await makeUser("profA", "professional");
  const { data: profA } = await admin.from("professionals").select("id").eq("user_id", uA.id).single();
  const uB = await makeUser("profB", "professional");
  const { data: profB } = await admin.from("professionals").select("id").eq("user_id", uB.id).single();

  const { data: patA } = await admin.from("patients").insert({ professional_id: profA.id, full_name: "Pac A", status: "active" }).select("id").single();
  const uPatA = await makeUser("patA", "patient");
  await admin.from("patients").update({ user_id: uPatA.id }).eq("id", patA.id);
  const { data: patB } = await admin.from("patients").insert({ professional_id: profB.id, full_name: "Pac B", status: "active" }).select("id").single();
  const uPatB = await makeUser("patB", "patient");
  await admin.from("patients").update({ user_id: uPatB.id }).eq("id", patB.id);

  const a = await signIn(uA.email);
  const b = await signIn(uB.email);
  const pA = await signIn(uPatA.email);
  const pB = await signIn(uPatB.email);

  console.log("\n== Diario emocional ==");
  {
    const { error } = await pA.from("mood_entries").insert({ patient_id: patA.id, mood_value: 4, note: "buen día" });
    check("el paciente registra su ánimo", !error, error?.message);
  }
  {
    const { data } = await a.from("mood_entries").select("id").eq("patient_id", patA.id);
    check("su profesional ve el diario", (data ?? []).length >= 1);
  }
  {
    const { data } = await b.from("mood_entries").select("id").eq("patient_id", patA.id);
    check("otro profesional NO ve el diario", (data ?? []).length === 0);
  }

  console.log("\n== Recursos (por paciente y generales) ==");
  const { data: rLink } = await a.from("resources").insert({ professional_id: profA.id, patient_id: patA.id, title: "Guía", kind: "link", url: "https://ej.com/g" }).select("id").single();
  const { data: rShared } = await a.from("resources").insert({ professional_id: profA.id, patient_id: null, title: "General", kind: "link", url: "https://ej.com/s" }).select("id").single();
  {
    const { data } = await pA.from("resources").select("id");
    const ids = (data ?? []).map((r) => r.id);
    check("el paciente ve su recurso y el general", ids.includes(rLink.id) && ids.includes(rShared.id));
  }
  {
    const { data } = await pB.from("resources").select("id");
    const ids = (data ?? []).map((r) => r.id);
    check("paciente de otro profesional NO ve esos recursos", !ids.includes(rLink.id) && !ids.includes(rShared.id));
  }

  console.log("\n== Documentos / Storage privado ==");
  uploadedPath = `${patA.id}/doc-${rnd}.txt`;
  {
    const blob = new Blob(["contenido de prueba"], { type: "text/plain" });
    const { error } = await a.storage.from("files").upload(uploadedPath, blob);
    check("el profesional sube un archivo del paciente", !error, error?.message);
    await a.from("documents").insert({ professional_id: profA.id, patient_id: patA.id, title: "Informe", storage_path: uploadedPath });
  }
  {
    const { data } = await pA.storage.from("files").createSignedUrl(uploadedPath, 60);
    check("el paciente obtiene URL firmada de su documento", !!data?.signedUrl);
  }
  {
    const { data } = await b.storage.from("files").createSignedUrl(uploadedPath, 60);
    check("otro profesional NO puede firmar el archivo", !data?.signedUrl);
  }
  {
    const { data } = await pB.storage.from("files").createSignedUrl(uploadedPath, 60);
    check("otro paciente NO puede firmar el archivo", !data?.signedUrl);
  }
  {
    const blob = new Blob(["intruso"], { type: "text/plain" });
    const { error } = await b.storage.from("files").upload(`${patA.id}/intruso-${rnd}.txt`, blob);
    check("otro profesional NO puede subir al paciente de A", !!error, error ? "" : "no dio error");
  }
}

async function cleanup() {
  console.log("\n== Limpieza ==");
  if (uploadedPath) await admin.storage.from("files").remove([uploadedPath]).catch(() => {});
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
console.log("Diario + recursos + documentos verificados ✅");
