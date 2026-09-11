/**
 * Escenario de DEMOSTRACIÓN sobre la consulta ficticia ya sembrada.
 *
 * Qué resuelve: `seed.mjs` crea historial, pero deja la consulta inservible para
 * enseñarla. Ningún paciente tenía cuenta (nadie podía entrar en la app), no
 * había ni un consentimiento firmado (sin él la app del paciente no deja hacer
 * nada) y la última cita era del 19 de agosto, así que la agenda y la pantalla
 * de inicio salían vacías.
 *
 * Qué hace:
 *   1. Fija contraseña conocida a la profesional de demostración.
 *   2. Da cuenta real a UNA paciente y completa su alta por el camino de
 *      verdad: invitación → token → consentimiento firmado. No se insertan
 *      atajos: si este script termina, el alta funciona en producción.
 *   3. Refresca la línea temporal: citas de las próximas dos semanas para toda
 *      la consulta, tareas y diario recientes de la paciente de demostración.
 *   4. Deja una solicitud de cita esperando respuesta, para que la bandeja del
 *      profesional tenga algo que enseñar desde el primer momento.
 *
 * Idempotente: re-ejecutarlo no duplica citas, tareas ni solicitudes.
 *
 * SOLO DATOS FICTICIOS. Nombres, correos y notas son inventados.
 *
 *   node --env-file=.env.local scripts/seed-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY");
}

const PASSWORD = process.env.DEMO_PASSWORD || "Demo-terapia-2026!";
if (PASSWORD.length < 12) throw new Error("DEMO_PASSWORD: mínimo 12 caracteres");

const PRO_EMAIL = process.env.DEMO_PRO_EMAIL || "dra.romero@demo.terapia";
const DEMO_PATIENT = process.env.DEMO_PATIENT_NAME || "Ana Nadal";
const DEMO_PATIENT_EMAIL =
  process.env.DEMO_PATIENT_EMAIL || "ana.nadal@demo.terapia";

const client = (key) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = client(serviceKey);

const ok = async (req) => {
  const r = await req;
  if (r.error) throw new Error(r.error.message ?? JSON.stringify(r.error));
  return r.data;
};

const log = (msg) => console.log(msg);

// Todas las fechas se razonan en hora de pared española, como el resto de la
// app (`src/lib/tz.ts`). El proceso puede correr en otra zona: usar
// `setHours` sobre la hora local desplazaría las citas.
const TZ = "Europe/Madrid";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Día de calendario en Madrid ('YYYY-MM-DD') de un instante. */
const ymd = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** [año, mes, día] en Madrid de HOY+n. */
function dayPlus(n) {
  const [y, m, d] = ymd(new Date()).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

/**
 * Instante correspondiente a una hora de pared en Madrid. Prueba los dos
 * desfases posibles (CET +1 / CEST +2) y se queda con el que, al formatearse de
 * vuelta en Madrid, devuelve exactamente la hora pedida: así el cambio de
 * horario de octubre no desplaza ninguna cita.
 */
function madridInstant(y, m, d, hh, mm = 0) {
  for (const off of [2, 1]) {
    const t = new Date(Date.UTC(y, m - 1, d, hh - off, mm));
    const p = Object.fromEntries(
      fmt.formatToParts(t).filter((x) => x.type !== "literal")
        .map((x) => [x.type, Number(x.value)]),
    );
    if (p.year === y && p.month === m && p.day === d && p.hour === hh && p.minute === mm) {
      return t;
    }
  }
  throw new Error(`Hora inexistente en ${TZ}: ${y}-${m}-${d} ${hh}:${mm}`);
}

/** Instante de HOY+n días a una hora de pared concreta, en hora española. */
function at(daysFromToday, hour, minute = 0) {
  return madridInstant(...dayPlus(daysFromToday), hour, minute);
}

/** Días hasta el próximo día de la semana (1 = lunes), a partir de mañana. */
function nextWeekday(weekday, weeksAhead = 0) {
  for (let i = 1; i <= 28; i++) {
    const [y, m, d] = dayPlus(i);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
    if (dow === weekday) {
      if (weeksAhead === 0) return i;
      weeksAhead--;
    }
  }
  return 7;
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = data?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (!data?.users?.length || data.users.length < 200) return null;
  }
  return null;
}

/** Crea la cuenta si no existe; si existe, le fija la contraseña conocida. */
async function ensureAccount(email, role, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await ok(
      admin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { ...existing.app_metadata, role },
      }),
    );
    log(`  cuenta existente actualizada: ${email} (${role})`);
    return existing.id;
  }
  const { user } = await ok(
    admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    }),
  );
  log(`  cuenta creada: ${email} (${role})`);
  return user.id;
}

/** Sesión real de ese usuario (la misma que usaría el navegador). */
async function signIn(email) {
  const db = client(anonKey);
  const { error } = await db.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`);
  return db;
}

// ---------------------------------------------------------------------------

// `--dates` comprueba el calendario sin tocar la base de datos.
if (process.argv.includes("--dates")) {
  const dias = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  log(`hoy en ${TZ}: ${ymd(new Date())}`);
  for (const wd of [1, 2, 3, 4, 5]) {
    for (const semana of [0, 1]) {
      const n = nextWeekday(wd, semana);
      const inst = at(n, 17);
      log(`  ${dias[wd]} +${semana} → ${ymd(inst)} ${fmt.format(inst).slice(-5)} (${inst.toISOString()})`);
    }
  }
  log(`diario: de ${ymd(at(-11, 12))} a ${ymd(at(0, 12))}`);
  process.exit(0);
}

log("\nEscenario de demostración — SOLO DATOS FICTICIOS\n");

// 1 · Profesional -----------------------------------------------------------
log("1 · Profesional");
const proUserId = await ensureAccount(PRO_EMAIL, "professional", "Dra. Ana Romero");
const pro = await ok(
  admin.from("professionals").select("id, full_name").eq("user_id", proUserId).single(),
);
log(`  ${pro.full_name} → ${PRO_EMAIL}`);

const patients = await ok(
  admin
    .from("patients")
    .select("id, full_name, user_id, email")
    .eq("professional_id", pro.id)
    .eq("status", "active")
    .order("full_name"),
);
if (!patients.length) throw new Error("La consulta no tiene pacientes. Ejecuta antes `npm run seed`.");

const demo = patients.find((p) => p.full_name === DEMO_PATIENT) ?? patients[0];
log(`  ${patients.length} pacientes activos; protagonista: ${demo.full_name}`);

// 2 · Alta real de la paciente ----------------------------------------------
log("\n2 · Alta de la paciente (camino real: invitación → consentimiento)");
if (demo.user_id) {
  await ensureAccount(DEMO_PATIENT_EMAIL, "patient", demo.full_name);
  log("  ya estaba vinculada; contraseña actualizada");
} else {
  // issue_invitation exige que la ficha tenga correo.
  if (demo.email !== DEMO_PATIENT_EMAIL) {
    await ok(
      admin.from("patients").update({ email: DEMO_PATIENT_EMAIL }).eq("id", demo.id),
    );
    log(`  correo de la ficha: ${DEMO_PATIENT_EMAIL}`);
  }
  await ensureAccount(DEMO_PATIENT_EMAIL, "patient", demo.full_name);

  const proDb = await signIn(PRO_EMAIL);
  const token = randomUUID();
  await ok(
    proDb.rpc("issue_invitation", {
      p_patient_id: demo.id,
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    }),
  );
  log("  invitación emitida por la profesional");

  const patDb = await signIn(DEMO_PATIENT_EMAIL);
  const consent = await ok(patDb.rpc("get_onboarding_consent", { p_token: token }));
  await ok(
    patDb.rpc("complete_onboarding", {
      p_token: token,
      p_template_id: consent.id,
      p_content_hash: consent.hash,
    }),
  );
  const signed = await ok(patDb.rpc("has_current_consent"));
  if (!signed) throw new Error("El consentimiento no quedó firmado");
  log("  consentimiento firmado y cuenta vinculada ✅");
}

// 3 · Línea temporal --------------------------------------------------------
log("\n3 · Citas de las próximas dos semanas");

const existingFuture = await ok(
  admin
    .from("appointments")
    .select("id, patient_id, starts_at")
    .eq("professional_id", pro.id)
    .gte("starts_at", new Date().toISOString()),
);

// Rejilla de consulta: cada paciente su hueco semanal, dos semanas seguidas.
const GRID = [
  { weekday: 1, hour: 10 },
  { weekday: 1, hour: 17 },
  { weekday: 2, hour: 11 },
  { weekday: 3, hour: 16 },
  { weekday: 4, hour: 18 },
  { weekday: 5, hour: 9 },
];

const rows = [];
patients.forEach((p, i) => {
  const slot = GRID[i % GRID.length];
  for (const week of [0, 1]) {
    const days = nextWeekday(slot.weekday, week);
    const starts = at(days, slot.hour);
    const ends = new Date(starts.getTime() + 50 * 60_000);
    const already = existingFuture.some(
      (a) =>
        a.patient_id === p.id &&
        Math.abs(new Date(a.starts_at).getTime() - starts.getTime()) < 3600_000,
    );
    if (already) return;
    rows.push({
      professional_id: pro.id,
      patient_id: p.id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      // La de la protagonista, confirmada: es la que se enseña en la app.
      status: p.id === demo.id && week === 0 ? "confirmed" : "scheduled",
      video_link:
        p.id === demo.id && week === 0 ? "https://meet.example.com/demo-terapia" : null,
    });
  }
});

if (rows.length) {
  await ok(admin.from("appointments").insert(rows));
  log(`  ${rows.length} citas creadas`);
} else {
  log("  ya había citas futuras; no se duplica nada");
}

// 4 · Tareas y diario de la protagonista ------------------------------------
log("\n4 · Tareas y diario recientes");

const TASKS = [
  {
    title: "Registro de pensamientos (3 situaciones)",
    description:
      "Anota la situación, lo que pensaste y qué hiciste después. Sin corregir nada todavía.",
    due: 3,
  },
  {
    title: "Practicar respiración 4-7-8 antes de dormir",
    description: "Cinco minutos, cinco noches esta semana.",
    due: 6,
  },
];

const existingTasks = await ok(
  admin.from("tasks").select("title").eq("patient_id", demo.id),
);
const newTasks = TASKS.filter(
  (t) => !existingTasks.some((e) => e.title === t.title),
).map((t) => ({
  professional_id: pro.id,
  patient_id: demo.id,
  title: t.title,
  description: t.description,
  due_date: ymd(at(t.due, 12)),
}));
if (newTasks.length) {
  await ok(admin.from("tasks").insert(newTasks));
  log(`  ${newTasks.length} tareas pendientes`);
} else {
  log("  las tareas ya existían");
}

// Diario de los últimos 12 días: una tendencia suave, sin dramatismo.
const MOODS = [3, 3, 2, 3, 4, 3, 4, 4, 3, 4, 4, 5];
const NOTES = [
  "Día tranquilo.",
  null,
  "Mala noche, me costó arrancar.",
  null,
  "Salí a andar y me vino bien.",
  null,
  "Buena conversación con mi hermana.",
  null,
  "Algo cansada, pero bien.",
  null,
  "He dormido mejor.",
  "Buen día.",
];
const moodRows = MOODS.map((mood_value, i) => ({
  patient_id: demo.id,
  mood_value,
  note: NOTES[i],
  entry_date: ymd(at(-(MOODS.length - 1 - i), 12)),
}));
await ok(
  admin.from("mood_entries").upsert(moodRows, { onConflict: "patient_id,entry_date" }),
);
log(`  ${moodRows.length} entradas de diario (últimos ${MOODS.length} días)`);

// 5 · Una solicitud esperando respuesta -------------------------------------
log("\n5 · Bandeja de solicitudes");

const otro = patients.find((p) => p.id !== demo.id);
const yaHay = await ok(
  admin
    .from("appointment_requests")
    .select("id")
    .eq("professional_id", pro.id)
    .eq("status", "pending"),
);
if (yaHay.length) {
  log(`  ya hay ${yaHay.length} solicitud(es) pendiente(s)`);
} else if (otro) {
  await ok(
    admin.from("appointment_requests").insert({
      professional_id: pro.id,
      patient_id: otro.id,
      kind: "new",
      preferred_start: at(nextWeekday(3), 19).toISOString(),
      alt_start: at(nextWeekday(5), 10).toISOString(),
      duration_min: 50,
      note: "¿Sería posible por la tarde? Por las mañanas no puedo salir del trabajo.",
    }),
  );
  log(`  solicitud de ${otro.full_name} esperando respuesta`);
}

// Resumen -------------------------------------------------------------------
log("\n" + "─".repeat(60));
log("Listo. Credenciales de la demostración (ficticias):");
log("");
log(`  Profesional  ${PRO_EMAIL}`);
log(`  Paciente     ${DEMO_PATIENT_EMAIL}`);
log(`  Contraseña   ${PASSWORD}`);
log("");
log("Entra por /login con correo y contraseña (sin enlace mágico).");
log("─".repeat(60) + "\n");
