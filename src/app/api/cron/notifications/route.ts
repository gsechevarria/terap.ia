import { timingSafeEqual, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { Database } from "@/lib/database.types";
import { checked, allRows } from "@/lib/query-result";
import { isAllowedPushEndpoint, safeNotificationPath } from "@/lib/push-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const PREF = { appointment_reminder: "appointment_reminders", appointment_created: "new_appointment", new_task: "new_task", new_scale: "new_scale" } as const;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return new Response("No autorizado", { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, step: "configuration" }, { status: 503 });
  const admin = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const deadline = Date.now() + 40_000;
  const summary = { sent: 0, skipped: 0, retrying: 0, failed: 0, cleaned: 0 };
  try {
    // La limpieza es duradera e idempotente. Nunca borrar un objeto aún referenciado.
    const jobs = await checked(admin.from("storage_cleanup_jobs").select("*").lte("available_at", new Date().toISOString()).order("created_at").limit(20));
    for (const job of jobs.data ?? []) {
      if (Date.now() >= deadline) break;
      const refs = job.bucket === "receipts"
        ? [await checked(admin.from("gastos").select("id").eq("adjunto_path", job.path).limit(1))]
        : await Promise.all([
          checked(admin.from("documents").select("id").eq("storage_path", job.path).limit(1)),
          checked(admin.from("resources").select("id").eq("storage_path", job.path).limit(1)),
        ]);
      if (refs.some(r => r.data?.length)) continue;
      await checked(admin.storage.from(job.bucket).remove([job.path]));
      await checked(admin.from("storage_cleanup_jobs").delete().eq("id", job.id));
      summary.cleaned++;
    }
    await checked(admin.rpc("queue_appointment_reminders"));
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return NextResponse.json({ ok: false, step: "vapid", ...summary }, { status: 503 });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@terap.ia", publicKey, privateKey);
    const lock = randomUUID();
    const { data: pending } = await checked(admin.rpc("claim_notifications", { p_token: lock, p_limit: 20 }));
    // Cinco trabajadores; cada envío tiene timeout. Las reclamaciones caducan si el proceso cae.
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        if (Date.now() >= deadline) return;
        const n = pending?.[cursor++];
        if (!n) return;
        let skip = false;
        const payload = (n.payload ?? {}) as { url?: string; appointment_id?: string; starts_at?: string };
        if (n.type === "appointment_reminder" && payload.appointment_id) {
          const { data: a } = await checked(admin.from("appointments").select("starts_at,status,patients(user_id)").eq("id", payload.appointment_id).maybeSingle());
          skip = !a || !["scheduled", "confirmed"].includes(a.status) || new Date(a.starts_at).getTime() <= Date.now()
            || new Date(a.starts_at).getTime() !== new Date(payload.starts_at ?? "").getTime()
            || a.patients?.user_id !== n.user_id;
        }
        const { data: pref } = await checked(admin.from("notification_preferences").select("*").eq("user_id", n.user_id).maybeSingle());
        const prefKey = PREF[n.type as keyof typeof PREF];
        if (prefKey && pref?.[prefKey] === false) skip = true;
        let delivered = false;
        if (!skip) {
          const { data: subs } = await allRows(admin.from("push_subscriptions").select("*").eq("user_id", n.user_id));
          const { data: deliveries } = await checked(admin.from("notification_deliveries").select("subscription_id").eq("notification_id", n.id));
          const done = new Set(deliveries?.map(d => d.subscription_id));
          let allOk = subs.length > 0;
          for (const sub of subs) {
            if (done.has(sub.id)) continue;
            if (Date.now() >= deadline) { allOk = false; break; }
            if (!isAllowedPushEndpoint(sub.endpoint)) {
              await checked(admin.from("push_subscriptions").delete().eq("id", sub.id));
              allOk = false;
              continue;
            }
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
                title: "terap.ia", body: "Tienes una novedad en tu cuenta.",
                url: safeNotificationPath(payload.url), tag: n.id,
              }), { timeout: 5000, TTL: 3600 });
              await checked(admin.from("notification_deliveries").upsert({ notification_id: n.id, subscription_id: sub.id }));
            } catch (error) {
              allOk = false;
              const status = (error as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) await checked(admin.from("push_subscriptions").delete().eq("id", sub.id));
            }
          }
          delivered = allOk;
        }
        const attempts = (n.retry_count ?? 0) + 1;
        const status = skip || delivered ? "sent" : attempts >= 5 ? "failed" : "queued";
        await checked(admin.from("notifications").update({
          status, sent_at: delivered ? new Date().toISOString() : null,
          retry_count: attempts, lock_token: null, locked_until: null,
          next_attempt_at: status === "queued" ? new Date(Date.now() + Math.min(2 ** attempts, 60) * 60000).toISOString() : null,
        }).eq("id", n.id).eq("lock_token", lock));
        if (skip) summary.skipped++; else if (delivered) summary.sent++;
        else if (status === "failed") summary.failed++; else summary.retrying++;
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    console.error("[cron] Operación incompleta; los trabajos pendientes se recuperarán.");
    return NextResponse.json({ ok: false, ...summary }, { status: 500 });
  }
}
