"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMoodEntryAction } from "@/lib/actions/mood";

const FACES = [
  { value: 1, emoji: "😞", label: "Muy mal" },
  { value: 2, emoji: "🙁", label: "Mal" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Bien" },
  { value: 5, emoji: "😄", label: "Muy bien" },
];

export function MoodLogger() {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (value == null) return;
    startTransition(async () => {
      await addMoodEntryAction(value, note);
      setValue(null);
      setNote("");
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 2500);
    });
  }

  return (
    <section className="card p-4">
      <h2 className="text-base font-semibold">¿Cómo estás hoy?</h2>
      <div className="mt-3 flex justify-between gap-1">
        {FACES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setValue(f.value)}
            aria-label={f.label}
            className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded border py-2 transition-colors duration-100 ${
              value === f.value
                ? "border-accent bg-accent-soft"
                : "border-transparent hover:bg-wash"
            }`}
          >
            <span className="text-2xl">{f.emoji}</span>
            <span className="text-[10px] text-ink-2">{f.label}</span>
          </button>
        ))}
      </div>

      {value != null && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="¿Quieres añadir algo? (opcional)"
            className="field"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="btn-primary self-start"
          >
            {pending ? "Guardando…" : "Registrar"}
          </button>
        </div>
      )}

      {done && <p className="mt-3 text-sm font-medium text-accent">Registrado</p>}
    </section>
  );
}
