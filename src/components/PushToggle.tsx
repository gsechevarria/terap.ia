"use client";

import { useEffect, useState } from "react";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/lib/actions/notifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const ok =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      if (!active) return;
      if (!ok) {
        setSupported(false);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) setSubscribed(!!sub);
      } catch {
        /* ignorar */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function subscribe() {
    setBusy(true);
    setMsg("");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Falta la clave VAPID pública.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Permiso de notificaciones denegado.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscriptionAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setSubscribed(true);
      setMsg("Notificaciones activadas en este dispositivo.");
    } catch {
      setMsg("No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Notificaciones desactivadas en este dispositivo.");
    } catch {
      setMsg("No se pudieron desactivar.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-ink-2">
        Este dispositivo o navegador no admite notificaciones push.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={busy}
        className={`self-start ${subscribed ? "btn-ghost" : "btn-primary"}`}
      >
        {busy
          ? "…"
          : subscribed
            ? "Desactivar notificaciones"
            : "Activar notificaciones en este dispositivo"}
      </button>
      {msg && <p className="text-sm text-ink-2">{msg}</p>}
    </div>
  );
}
