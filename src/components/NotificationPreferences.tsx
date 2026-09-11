"use client";
import { actionErrorMessage } from "@/lib/errors";
import { callAction } from "@/lib/action-result";

import { useState, useTransition } from "react";
import {
  savePreferencesAction,
  type NotificationPrefs,
} from "@/lib/actions/notifications";

const OPTIONS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "appointment_reminders", label: "Recordatorios de cita (durante las 24 h anteriores)" },
  { key: "new_appointment", label: "Nueva cita" },
  { key: "new_task", label: "Nueva tarea" },
  { key: "new_scale", label: "Nuevo cuestionario" },
];

export function NotificationPreferences({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState({ ...initial, email_fallback: false });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setError("");
    startTransition(async () => {
      try { await callAction(savePreferencesAction, next); setPrefs(next); }
      catch (e) { setError(actionErrorMessage(e)); }
    });
  }

  return (
    <ul className="card divide-y divide-line">
      {error && <li role="alert" className="p-3 text-sm text-danger">{error}</li>}
      {OPTIONS.map((o) => (
        <li key={o.key}>
          <label className="row-hover flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={prefs[o.key]}
              disabled={pending}
              onChange={() => toggle(o.key)}
              className="size-4 accent-[var(--accent)]"
            />
            {o.label}
          </label>
        </li>
      ))}
    </ul>
  );
}
