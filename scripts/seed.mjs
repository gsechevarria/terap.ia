// =============================================================================
// Seed idempotente de datos FICTICIOS para la demo de terap.ia.
//   - 2 profesionales; ~10 pacientes; ~3 meses de histórico.
//   - Citas con asistencia, pagos + un bono, escalas con trayectorias (incluida
//     una alerta de ítem 9 del PHQ-9), diario emocional y tareas.
//   - Idempotente: si un profesional ya tiene pacientes, no vuelve a sembrar.
//
// Ejecutar:            npm run seed
// Bajo tu email (para poder entrar por enlace mágico y ver la consulta):
//   SEED_PRO_EMAIL=tu-correo@dominio npm run seed
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PW = "terapia-demo-" + "2026";
const PRO1_EMAIL = process.env.SEED_PRO_EMAIL || "dra.romero@demo.terapia";
const PRO2_EMAIL = process.env.SEED_PRO2_EMAIL || "dr.ferrer@demo.terapia";

const DAY = 86400e3;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const dateOnly = (ms) => new Date(ms).toISOString().slice(0, 10);
const pick = (arr, i) => arr[i % arr.length];

async function findUserByEmail(email) {
  // Paginar hasta encontrar (suficiente para un proyecto de demo).
  for (let page = 1; page <= 10; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const u = data?.users?.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (!data || data.users.length < 200) break;
  }
  return null;
}

async function ensureProfessional(email, name) {
  let userId;
  const created = await db.auth.admin.createUser({
    email,
    password: DEMO_PW,
    email_confirm: true,
    user_metadata: { role: "professional", full_name: name },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else {
    const existing = await findUserByEmail(email);
    if (!existing) throw new Error(`No se pudo crear ni encontrar ${email}`);
    userId = existing.id;
    // Asegurar rol profesional en el metadata.
    if (existing.user_metadata?.role !== "professional") {
      await db.auth.admin.updateUserById(userId, {
        user_metadata: { ...existing.user_metadata, role: "professional", full_name: name },
      });
    }
  }
  // Asegurar fila professionals (el trigger la crea al registrar; si el usuario
  // ya existía sin ella, la creamos).
  let { data: pro } = await db.from("professionals").select("id").eq("user_id", userId).maybeSingle();
  if (!pro) {
    const ins = await db
      .from("professionals")
      .insert({ user_id: userId, email, full_name: name })
      .select("id")
      .single();
    pro = ins.data;
  }
  return pro.id;
}

const FIRST = ["Ana", "Marco", "Lucía", "Diego", "Sara", "Pablo", "Elena", "Hugo", "Nadia", "Iván"];
const LAST = ["García", "Ferrer", "Ortiz", "Nadal", "Ríos", "Prat", "Vega", "Soler", "Marín", "Cano"];
const TAGSETS = [["ansiedad"], ["depresión"], ["ansiedad", "quincenal"], ["estrés"], ["duelo"], ["pareja"]];
const TASK_TITLES = ["Registro de pensamientos", "Ejercicio de respiración", "Diario de gratitud", "Higiene del sueño"];
const TRAJECTORIES = {
  improving: [17, 15, 12, 10, 7, 5],
  worsening: [6, 8, 11, 13, 16, 18],
  stable: [10, 9, 11, 10, 9, 10],
};

function answersForScore(numItems, target, item9Value = null) {
  const ans = {};
  for (let i = 1; i <= numItems; i++) ans[String(i)] = 0;
  let rem = target;
  if (item9Value != null && numItems >= 9) {
    ans["9"] = item9Value;
    rem -= item9Value;
  }
  for (let i = 1; i <= numItems && rem > 0; i++) {
    if (i === 9 && item9Value != null) continue;
    const add = Math.min(3, rem);
    ans[String(i)] = add;
    rem -= add;
  }
  return ans;
}

async function seedPatient(proId, idx, scales, opts) {
  const name = `${pick(FIRST, idx)} ${pick(LAST, idx + 3)}`;
  const { data: patient } = await db
    .from("patients")
    .insert({
      professional_id: proId,
      full_name: name,
      email: null,
      status: idx % 7 === 6 ? "archived" : "active",
      tags: pick(TAGSETS, idx),
    })
    .select("id")
    .single();
  const pid = patient.id;

  // --- Citas (12 semanas atrás, semanal) + 1 futura -------------------------
  const appts = [];
  for (let w = 12; w >= 1; w--) {
    const start = now - w * 7 * DAY + 10 * 3600e3; // ~10:00
    const roll = (idx + w) % 10;
    let attendance = "attended";
    let status = "completed";
    if (roll === 3) {
      attendance = "no_show";
      status = "scheduled";
    } else if (roll === 7) {
      attendance = "late_cancel";
      status = "cancelled";
    }
    appts.push({
      professional_id: proId,
      patient_id: pid,
      starts_at: iso(start),
      ends_at: iso(start + 50 * 60000),
      status,
      attendance,
      video_link: "https://meet.example/terapia",
    });
  }
  const future = now + 5 * DAY + 11 * 3600e3;
  appts.push({
    professional_id: proId,
    patient_id: pid,
    starts_at: iso(future),
    ends_at: iso(future + 50 * 60000),
    status: "confirmed",
    attendance: "pending",
    video_link: "https://meet.example/terapia",
  });
  await db.from("appointments").insert(appts);

  // --- Pagos: atendidas -> pagado (deja 2 recientes pendientes) + 1 bono ----
  const attendedCount = appts.filter((a) => a.attendance === "attended").length;
  const payments = [];
  let attendedSeen = 0;
  for (const a of appts) {
    if (a.attendance !== "attended") continue;
    attendedSeen++;
    const pending = attendedSeen > attendedCount - 2; // 2 más recientes pendientes
    payments.push({
      professional_id: proId,
      patient_id: pid,
      amount_cents: 6000,
      currency: "EUR",
      status: pending ? "pending" : "paid",
      paid_at: pending ? null : a.starts_at,
      method: pending ? null : "transferencia",
    });
  }
  if (payments.length) await db.from("payments").insert(payments);
  if (idx % 4 === 1) {
    await db.from("session_packs").insert({
      professional_id: proId,
      patient_id: pid,
      total_sessions: 10,
      used_sessions: 4,
      price_cents: 50000,
      currency: "EUR",
    });
  }

  // --- Escalas (opt-in en ~60% de pacientes) con trayectoria ----------------
  if (idx % 5 !== 4) {
    const trajName = pick(["improving", "worsening", "stable"], idx);
    const traj = TRAJECTORIES[trajName];
    const { data: asg } = await db
      .from("scale_assignments")
      .insert({
        professional_id: proId,
        patient_id: pid,
        scale_id: scales.phq9,
        assignment_type: "recurring",
        recurrence_interval_days: 14,
        active: true,
      })
      .select("id")
      .single();
    const responses = [];
    for (let k = 0; k < traj.length; k++) {
      const when = now - (traj.length - 1 - k) * 14 * DAY;
      // Alerta ítem 9 en la respuesta más reciente del paciente marcado.
      const item9 = opts.flagItem9 && k === traj.length - 1 ? 2 : 0;
      responses.push({
        assignment_id: asg.id,
        patient_id: pid,
        scale_id: scales.phq9,
        answers: answersForScore(9, traj[k], item9),
        submitted_at: iso(when),
      });
    }
    await db.from("scale_responses").insert(responses);

    if (idx % 3 === 0) {
      const { data: gasg } = await db
        .from("scale_assignments")
        .insert({
          professional_id: proId,
          patient_id: pid,
          scale_id: scales.gad7,
          assignment_type: "recurring",
          recurrence_interval_days: 14,
          active: true,
        })
        .select("id")
        .single();
      const gres = TRAJECTORIES.improving.map((s, k) => ({
        assignment_id: gasg.id,
        patient_id: pid,
        scale_id: scales.gad7,
        answers: answersForScore(7, Math.min(s, 21)),
        submitted_at: iso(now - (5 - k) * 14 * DAY),
      }));
      await db.from("scale_responses").insert(gres);
    }
  }

  // --- Diario emocional (~70% de pacientes) ---------------------------------
  if (idx % 10 !== 9) {
    const moods = [];
    for (let d = 84; d >= 0; d -= 3) {
      const base = 2 + Math.round((84 - d) / 30); // tendencia suave a mejor
      const val = Math.max(1, Math.min(5, base + ((idx + d) % 3) - 1));
      moods.push({
        patient_id: pid,
        mood_value: val,
        note: d % 12 === 0 ? "Semana algo mejor." : null,
        entry_date: dateOnly(now - d * DAY),
      });
    }
    await db.from("mood_entries").insert(moods);
  }

  // --- Tareas (3; una completada) ------------------------------------------
  const tasks = [];
  for (let t = 0; t < 3; t++) {
    tasks.push({
      professional_id: proId,
      patient_id: pid,
      title: pick(TASK_TITLES, idx + t),
      description: null,
      due_date: dateOnly(now + (t + 1) * 3 * DAY),
    });
  }
  const { data: insertedTasks } = await db.from("tasks").insert(tasks).select("id");
  if (insertedTasks?.[0]) {
    await db.from("task_completions").insert({
      task_id: insertedTasks[0].id,
      patient_id: pid,
      response_text: "Hecho, me ayudó a parar y observar.",
    });
  }

  return name;
}

// Céntimos desde euros (dinero en int, como el resto del proyecto).
const eurC = (e) => Math.round(e * 100);

// Gastos ficticios repartidos por categorías y meses (dentro del ejercicio en curso).
const GASTOS_SEED = [
  { m: 0, categoria: "software", concepto: "Suscripción software de gestión", proveedor: "Software SL", base: 29, iva: 21, afect: 100 },
  { m: 0, categoria: "alquiler_consulta", concepto: "Alquiler consulta (julio)", proveedor: "Inmobiliaria Centro", base: 500, iva: 21, afect: 100 },
  { m: 1, categoria: "alquiler_consulta", concepto: "Alquiler consulta (junio)", proveedor: "Inmobiliaria Centro", base: 500, iva: 21, afect: 100 },
  { m: 1, categoria: "suministros", concepto: "Electricidad y agua", proveedor: "Energía Ibérica", base: 65, iva: 21, afect: 50 },
  { m: 2, categoria: "formacion", concepto: "Curso de terapia contextual", proveedor: "Instituto Formación", base: 240, iva: 21, afect: 100 },
  { m: 2, categoria: "material", concepto: "Material de consulta", proveedor: "Papelería Técnica", base: 48, iva: 21, afect: 100 },
  { m: 3, categoria: "gestoria", concepto: "Honorarios gestoría (trimestre)", proveedor: "Gestoría Fiscal", base: 80, iva: 21, afect: 100 },
  { m: 3, categoria: "alquiler_consulta", concepto: "Alquiler consulta (abril)", proveedor: "Inmobiliaria Centro", base: 500, iva: 21, afect: 100 },
  { m: 4, categoria: "desplazamiento", concepto: "Transporte a supervisión", proveedor: "Renfe", base: 32, iva: 10, afect: 100 },
  { m: 4, categoria: "cuota_colegial", concepto: "Cuota colegial trimestral", proveedor: "Colegio de Psicología", base: 90, iva: 0, afect: 100 },
  { m: 5, categoria: "seguro_rc", concepto: "Seguro de responsabilidad civil", proveedor: "Aseguradora Mutua", base: 320, iva: 0, afect: 100 },
  { m: 5, categoria: "suministros", concepto: "Internet y teléfono", proveedor: "Telecom", base: 45, iva: 21, afect: 50 },
  { m: 6, categoria: "otros", concepto: "Gastos varios de consulta", proveedor: "Varios", base: 22, iva: 21, afect: 100 },
  { m: 6, categoria: "software", concepto: "Herramienta de videollamada", proveedor: "Video SaaS", base: 15, iva: 21, afect: 100 },
];

// Bienes de inversión (se registran como gasto marcado + ficha de amortización).
const BIENES_SEED = [
  { m: 5, descripcion: "Portátil de consulta", proveedor: "Tienda Informática", base: 1200, iva: 21, afect: 100, amort: 25, anios: 4 },
  { m: 6, descripcion: "Mobiliario (sillón y diván)", proveedor: "Mobiliario Clínico", base: 850, iva: 21, afect: 100, amort: 10, anios: 10 },
];

/**
 * Siembra configuración fiscal + gastos + bienes de inversión (datos ficticios).
 * Idempotente por su cuenta: la config se upsertea; los gastos solo se crean si
 * el profesional aún no tiene ninguno (así funciona aunque el resto del seed ya
 * se hubiera ejecutado antes).
 */
async function seedContabilidad(proId, variante) {
  // Configuración fiscal: ED simplificada, IVA exenta, alta hace ~1 año.
  await db.from("configuracion_fiscal").upsert(
    {
      professional_id: proId,
      regimen: "estimacion_directa_simplificada",
      situacion_iva: "exenta",
      epigrafe_iae: "776",
      fecha_alta_actividad: dateOnly(now - 365 * DAY),
      aplica_retencion_default: false,
    },
    { onConflict: "professional_id" },
  );

  const { count: gCount } = await db
    .from("gastos")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", proId);
  if ((gCount ?? 0) > 0) {
    console.log("    · contabilidad: config ok; ya había gastos → se omite");
    return;
  }

  // Gastos corrientes.
  const rows = GASTOS_SEED.map((g) => {
    const baseC = eurC(g.base);
    const cuotaC = Math.round((baseC * g.iva) / 100);
    return {
      professional_id: proId,
      fecha: dateOnly(now - g.m * 30 * DAY),
      proveedor_nombre: g.proveedor,
      proveedor_nif: "B" + String(10000000 + ((variante + g.m) % 89999999)),
      categoria_deducible: g.categoria,
      concepto: g.concepto,
      base_cents: baseC,
      tipo_iva: g.iva,
      cuota_iva_cents: cuotaC,
      total_cents: baseC + cuotaC,
      porcentaje_afectacion: g.afect,
      es_bien_inversion: false,
    };
  });
  await db.from("gastos").insert(rows);

  // Bienes de inversión: el 1er profesional lleva 2; el resto, 1.
  const bienes = variante === 0 ? BIENES_SEED : BIENES_SEED.slice(0, 1);
  for (const b of bienes) {
    const baseC = eurC(b.base);
    const cuotaC = Math.round((baseC * b.iva) / 100);
    const fecha = dateOnly(now - b.m * 30 * DAY);
    const { data: gasto } = await db
      .from("gastos")
      .insert({
        professional_id: proId,
        fecha,
        proveedor_nombre: b.proveedor,
        categoria_deducible: "material",
        concepto: b.descripcion,
        base_cents: baseC,
        tipo_iva: b.iva,
        cuota_iva_cents: cuotaC,
        total_cents: baseC + cuotaC,
        porcentaje_afectacion: b.afect,
        es_bien_inversion: true,
      })
      .select("id")
      .single();
    await db.from("bienes_inversion").insert({
      professional_id: proId,
      gasto_id: gasto?.id ?? null,
      descripcion: b.descripcion,
      fecha_adquisicion: fecha,
      valor_adquisicion_cents: baseC,
      porcentaje_amortizacion: b.amort,
      anios_amortizacion: b.anios,
    });
  }
  console.log(`    · contabilidad: ${rows.length} gastos + ${bienes.length} bien(es) de inversión`);
}

async function seedProfessional(email, name, nPatients, scales, startIdx) {
  const proId = await ensureProfessional(email, name);
  // Contabilidad: idempotente por su cuenta; se siembra aunque los pacientes ya
  // existieran de una ejecución previa del seed.
  await seedContabilidad(proId, startIdx === 0 ? 0 : 1);
  const { count } = await db
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", proId);
  if ((count ?? 0) > 0) {
    console.log(`  ${name} (${email}) ya tiene pacientes → se omite (idempotente).`);
    return;
  }
  // Un recurso general compartido.
  await db.from("resources").insert({
    professional_id: proId,
    patient_id: null,
    title: "Guía de respiración diafragmática",
    kind: "link",
    url: "https://example.org/respiracion",
  });
  for (let i = 0; i < nPatients; i++) {
    const idx = startIdx + i;
    const flagItem9 = i === 0 && startIdx === 0; // 1er paciente del 1er profesional
    const pname = await seedPatient(proId, idx, scales, { flagItem9 });
    console.log(`    · ${pname}${flagItem9 ? " (con alerta ítem 9)" : ""}`);
  }
  console.log(`  ${name}: ${nPatients} pacientes sembrados.`);
}

async function main() {
  console.log("== Seed de datos ficticios (terap.ia) ==");
  const { data: phq9 } = await db.from("scales").select("id").eq("code", "PHQ-9").single();
  const { data: gad7 } = await db.from("scales").select("id").eq("code", "GAD-7").single();
  const scales = { phq9: phq9.id, gad7: gad7.id };

  await seedProfessional(PRO1_EMAIL, "Dra. Ana Romero", 6, scales, 0);
  await seedProfessional(PRO2_EMAIL, "Dr. Luis Ferrer", 4, scales, 6);

  console.log("\nProfesional 1:", PRO1_EMAIL, "· Profesional 2:", PRO2_EMAIL);
  console.log("Listo ✅  (para entrar por enlace mágico, ejecuta el seed con SEED_PRO_EMAIL=tu-correo)");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
