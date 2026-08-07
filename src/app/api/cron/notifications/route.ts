import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mapeo tipo de notificación -> clave de preferencia.
const PREF_KEY: Record<string, keyof PrefRow> = {
  appointment_reminder: "appointment_reminders",
  appointment_created: "new_appointment",
  new_task: "new_task",
  new_scale: "new_scale",
};

/**
 * Tipos que se envían SIEMPRE, ignorando las preferencias del usuario.
 *
 * `scale_flag` avisa al profesional de que un paciente ha marcado el ítem de
 * riesgo: es una alerta de seguridad clínica, no una notificación de
 * conveniencia, y no debe poder silenciarse desde los ajustes. Está explícito
 * y no solo ausente de PREF_KEY para que añadirle una preferencia sea una
 * decisión consciente y no un descuido.
 */
const SIEMPRE_ENVIAR = new Set(["scale_flag"]);

/** Máximo de reintentos antes de dar una notificación por perdida. */
const MAX_INTENTOS = 5;

type PrefRow = {
  appointment_reminders: boolean;
  new_appointment: boolean;
  new_task: boolean;
  new_scale: boolean;
  email_fallback: boolean;
};

/** Comparación en tiempo constante; `===` sobre strings hace cortocircuito. */
function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // `timingSafeEqual` exige la misma longitud; se compara contra sí mismo
    // para no dar una pista temporal por la vía rápida.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * Sin `CRON_SECRET` configurado NO se abre (nada de fail-open), y el secreto
 * solo se acepta por cabecera: la vía `?secret=` lo dejaba en los logs de
 * acceso de Vercel, en cualquier proxy intermedio y en el `Referer`.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && safeEq(header.slice(7), secret);
}

/** Error con contexto, sin datos personales. */
function logError(paso: string, detalle: Record<string, unknown>) {
  console.error(`[cron/notifications] ${paso}`, detalle);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new Response("No autorizado", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient<Database>(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soporte@terap.ia",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const now = new Date();
  const nowISO = now.toISOString();
  const summary = {
    remindersCreated: 0,
    sent: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
  };

  // ---------------------------------------------------------------------------
  // 1) Recordatorios de cita en la ventana 24-48 h
  // ---------------------------------------------------------------------------
  const from = new Date(now.getTime() + 24 * 3600e3).toISOString();
  const to = new Date(now.getTime() + 48 * 3600e3).toISOString();

  // `error` se comprueba en las CUATRO consultas. Antes se desestructuraba solo
  // `{ data }`: si la consulta fallaba, `appts` era undefined, el bucle no
  // iteraba y el endpoint devolvía `{ ok: true, sent: 0 }` — éxito aparente con
  // cero trabajo hecho, y nadie se enteraba de que los recordatorios habían
  // dejado de salir.
  const { data: appts, error: apptsErr } = await admin
    .from("appointments")
    .select("id, professional_id, patient_id, starts_at, patients(user_id)")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .in("status", ["scheduled", "confirmed"]);

  if (apptsErr) {
    logError("no se han podido leer las citas", { code: apptsErr.code });
    return NextResponse.json(
      { ok: false, step: "appointments", ...summary },
      { status: 500 },
    );
  }

  const candidatas = (appts ?? []).filter((a) => {
    const patient = a.patients as unknown as { user_id: string | null } | null;
    return Boolean(patient?.user_id);
  });

  if (candidatas.length > 0) {
    // Deduplicación EN LOTE: antes era un select por cita.
    const { data: yaEncoladas, error: dupErr } = await admin
      .from("notifications")
      .select("payload")
      .eq("type", "appointment_reminder")
      .in(
        "patient_id",
        candidatas.map((a) => a.patient_id),
      );
    if (dupErr) {
      logError("no se han podido leer las notificaciones existentes", {
        code: dupErr.code,
      });
      return NextResponse.json(
        { ok: false, step: "dedup", ...summary },
        { status: 500 },
      );
    }

    const yaAvisadas = new Set(
      (yaEncoladas ?? [])
        .map((n) => (n.payload as { appointment_id?: string } | null)?.appointment_id)
        .filter(Boolean),
    );

    const nuevas = candidatas
      .filter((a) => !yaAvisadas.has(a.id))
      .map((a) => {
        const patient = a.patients as unknown as { user_id: string };
        return {
          user_id: patient.user_id,
          professional_id: a.professional_id,
          patient_id: a.patient_id,
          channel: "push" as const,
          type: "appointment_reminder",
          title: "Recordatorio de cita",
          body: `Tienes una cita el ${formatDateTime(a.starts_at)}.`,
          payload: { appointment_id: a.id, url: "/app/appointments" },
          status: "queued" as const,
        };
      });

    if (nuevas.length > 0) {
      const { error: insErr } = await admin.from("notifications").insert(nuevas);
      if (insErr) {
        logError("no se han podido encolar los recordatorios", {
          code: insErr.code,
          count: nuevas.length,
        });
        return NextResponse.json(
          { ok: false, step: "enqueue", ...summary },
          { status: 500 },
        );
      }
      summary.remindersCreated = nuevas.length;
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Enviar las encoladas cuya hora ya ha llegado
  // ---------------------------------------------------------------------------
  const { data: queued, error: queuedErr } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, payload, scheduled_for, retry_count")
    .eq("status", "queued")
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowISO}`)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowISO}`)
    .order("created_at")
    .limit(200);

  if (queuedErr) {
    logError("no se ha podido leer la cola", { code: queuedErr.code });
    return NextResponse.json(
      { ok: false, step: "queue", ...summary },
      { status: 500 },
    );
  }

  const pendientes = queued ?? [];
  if (pendientes.length === 0) {
    return NextResponse.json({ ok: true, ...summary });
  }

  // Precarga EN LOTE de preferencias y suscripciones: antes eran dos consultas
  // POR notificación (hasta 400 viajes), más un update cada una. Con ~40 ms de
  // latencia eso pasaba de 25 s, por encima del límite de función en Hobby.
  const userIds = [...new Set(pendientes.map((n) => n.user_id))];

  const [prefsRes, subsRes] = await Promise.all([
    admin
      .from("notification_preferences")
      .select(
        "user_id, appointment_reminders, new_appointment, new_task, new_scale, email_fallback",
      )
      .in("user_id", userIds),
    admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds),
  ]);

  if (prefsRes.error || subsRes.error) {
    logError("no se han podido leer preferencias o suscripciones", {
      prefs: prefsRes.error?.code,
      subs: subsRes.error?.code,
    });
    return NextResponse.json(
      { ok: false, step: "fanout", ...summary },
      { status: 500 },
    );
  }

  const prefPorUsuario = new Map(
    (prefsRes.data ?? []).map((p) => [p.user_id, p as unknown as PrefRow]),
  );
  const subsPorUsuario = new Map<string, typeof subsRes.data>();
  for (const s of subsRes.data ?? []) {
    const lista = subsPorUsuario.get(s.user_id) ?? [];
    lista.push(s);
    subsPorUsuario.set(s.user_id, lista);
  }

  const marcarEnviada: string[] = [];
  const marcarOmitida: string[] = [];
  const reintentar: { id: string; retry_count: number }[] = [];
  const marcarFallida: string[] = [];
  const subsCaducadas: string[] = [];

  for (const n of pendientes) {
    const prefKey = PREF_KEY[n.type ?? ""];
    const pref = prefPorUsuario.get(n.user_id);
    const forzado = SIEMPRE_ENVIAR.has(n.type ?? "");
    if (!forzado && pref && prefKey && pref[prefKey] === false) {
      marcarOmitida.push(n.id);
      summary.skipped++;
      continue;
    }

    const subs = subsPorUsuario.get(n.user_id) ?? [];
    if (subs.length === 0) {
      // "Todavía no hay canal" NO es un fallo definitivo: antes se marcaba
      // `failed` (terminal) y la notificación no se reintentaba nunca, aunque
      // el usuario activase el push cinco minutos después.
      const intentos = (n.retry_count ?? 0) + 1;
      if (intentos >= MAX_INTENTOS) {
        marcarFallida.push(n.id);
        summary.failed++;
      } else {
        reintentar.push({ id: n.id, retry_count: intentos });
        summary.retrying++;
      }
      continue;
    }

    const payloadObj = (n.payload as { url?: string } | null) ?? {};
    const body = JSON.stringify({
      title: n.title ?? "terap.ia",
      body: n.body ?? "",
      url: payloadObj.url ?? "/app",
    });

    let anyOk = false;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        anyOk = true;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          subsCaducadas.push(s.id);
        } else {
          // Antes se descartaba todo lo que no fuese 404/410: un proveedor
          // caído o un 5xx desaparecían sin dejar rastro.
          logError("fallo al enviar push", {
            statusCode: code ?? "desconocido",
            notificationType: n.type,
          });
        }
      }
    }

    if (anyOk) {
      marcarEnviada.push(n.id);
      summary.sent++;
    } else {
      const intentos = (n.retry_count ?? 0) + 1;
      if (intentos >= MAX_INTENTOS) {
        marcarFallida.push(n.id);
        summary.failed++;
      } else {
        reintentar.push({ id: n.id, retry_count: intentos });
        summary.retrying++;
      }
    }
  }

  // Escrituras agrupadas: cuatro sentencias en vez de una por notificación.
  const backoffISO = (intentos: number) =>
    new Date(now.getTime() + Math.min(2 ** intentos, 24) * 3600e3).toISOString();

  // El cliente de Supabase es un *thenable* que NO rechaza: devuelve
  // `{ error }`. Con `Promise.allSettled` todo saldría "fulfilled" aunque la
  // escritura hubiese fallado, así que se comprueba el `error` de cada una.
  type Escritura = PromiseLike<{ error: { code?: string } | null }>;
  const escrituras: Escritura[] = [];

  if (marcarEnviada.length + marcarOmitida.length > 0) {
    escrituras.push(
      admin
        .from("notifications")
        .update({ status: "sent", sent_at: nowISO })
        .in("id", [...marcarEnviada, ...marcarOmitida]),
    );
  }
  if (marcarFallida.length > 0) {
    escrituras.push(
      admin.from("notifications").update({ status: "failed" }).in("id", marcarFallida),
    );
  }
  for (const r of reintentar) {
    escrituras.push(
      admin
        .from("notifications")
        .update({
          retry_count: r.retry_count,
          next_attempt_at: backoffISO(r.retry_count),
        })
        .eq("id", r.id),
    );
  }
  if (subsCaducadas.length > 0) {
    escrituras.push(
      admin.from("push_subscriptions").delete().in("id", subsCaducadas),
    );
  }

  const resultados = await Promise.all(escrituras);
  const fallosEscritura = resultados.filter((r) => r.error != null);
  if (fallosEscritura.length > 0) {
    logError("fallos al persistir el estado de la cola", {
      fallos: fallosEscritura.length,
      primerCodigo: fallosEscritura[0]?.error?.code,
    });
    return NextResponse.json(
      { ok: false, step: "persist", ...summary },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...summary });
}
