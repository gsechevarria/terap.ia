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
    <ul className="flex flex-col gap-2">
      {OPTIONS.map((o) => (
        <li key={o.key}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs[o.key]}
              disabled={pending}
              onChange={() => toggle(o.key)}
              className="h-4 w-4"
            />
            {o.label}
          </label>
        </li>
      ))}
    </ul>
  );
}
