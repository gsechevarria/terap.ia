import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
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

type PrefRow = {
  appointment_reminders: boolean;
  new_appointment: boolean;
  new_task: boolean;
  new_scale: boolean;
  email_fallback: boolean;
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const qs = req.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || qs === secret;
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
  const summary = { remindersCreated: 0, sent: 0, failed: 0, skipped: 0 };

  // 1) Recordatorios de cita en la ventana 24-48 h.
  const from = new Date(now.getTime() + 24 * 3600e3).toISOString();
  const to = new Date(now.getTime() + 48 * 3600e3).toISOString();
  const { data: appts } = await admin
    .from("appointments")
    .select("id, professional_id, patient_id, starts_at, patients(user_id)")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .in("status", ["scheduled", "confirmed"]);

  for (const a of appts ?? []) {
    const patient = a.patients as unknown as { user_id: string | null } | null;
    if (!patient?.user_id) continue;
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("type", "appointment_reminder")
      .eq("patient_id", a.patient_id)
      .contains("payload", { appointment_id: a.id })
      .limit(1)
      .maybeSingle();
    if (existing) continue;
    await admin.from("notifications").insert({
      user_id: patient.user_id,
      professional_id: a.professional_id,
      patient_id: a.patient_id,
      channel: "push",
      type: "appointment_reminder",
      title: "Recordatorio de cita",
      body: `Tienes una cita el ${new Date(a.starts_at).toLocaleString("es-ES")}.`,
      payload: { appointment_id: a.id, url: "/app/appointments" },
      status: "queued",
    });
    summary.remindersCreated++;
  }

  // 2) Enviar notificaciones encoladas cuya hora ya llegó.
  const { data: queued } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, payload, scheduled_for")
    .eq("status", "queued")
    .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
    .limit(200);

  for (const n of queued ?? []) {
    // Preferencia del usuario.
    const { data: pref } = await admin
      .from("notification_preferences")
      .select(
        "appointment_reminders, new_appointment, new_task, new_scale, email_fallback",
      )
      .eq("user_id", n.user_id)
      .maybeSingle();
    const prefKey = PREF_KEY[n.type ?? ""];
    if (pref && prefKey && pref[prefKey] === false) {
      await admin.from("notifications").update({ status: "sent", sent_at: now.toISOString() }).eq("id", n.id);
      summary.skipped++;
      continue;
    }

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", n.user_id);

    if (!subs || subs.length === 0) {
      await admin.from("notifications").update({ status: "failed" }).eq("id", n.id);
      summary.failed++;
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
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    await admin
      .from("notifications")
      .update(
        anyOk
          ? { status: "sent", sent_at: now.toISOString() }
          : { status: "failed" },
      )
      .eq("id", n.id);
    if (anyOk) summary.sent++;
    else summary.failed++;
  }

  return NextResponse.json({ ok: true, ...summary });
}
