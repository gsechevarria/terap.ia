"use client";

import { useState, useTransition } from "react";
import {
  savePreferencesAction,
  type NotificationPrefs,
} from "@/lib/actions/notifications";

const OPTIONS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "appointment_reminders", label: "Recordatorios de cita (24-48 h antes)" },
  { key: "new_appointment", label: "Nueva cita" },
  { key: "new_task", label: "Nueva tarea" },
  { key: "new_scale", label: "Nuevo cuestionario" },
  { key: "email_fallback", label: "Recibir por email si no hay push" },
];

export function NotificationPreferences({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    startTransition(() => savePreferencesAction(next));
  }

  return (
    <ul className="card divide-y divide-line">
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
