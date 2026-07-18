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
    <section className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
      <h2 className="text-lg font-semibold">¿Cómo estás hoy?</h2>
      <div className="mt-3 flex justify-between gap-1">
        {FACES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setValue(f.value)}
            aria-label={f.label}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg border py-2 transition-colors ${
              value === f.value
                ? "border-neutral-900 bg-black/[.04] dark:border-white dark:bg-white/[.08]"
                : "border-transparent hover:bg-black/[.03] dark:hover:bg-white/[.05]"
            }`}
          >
            <span className="text-2xl">{f.emoji}</span>
            <span className="text-[10px] text-neutral-500">{f.label}</span>
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
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.16]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "Guardando…" : "Registrar"}
          </button>
        </div>
      )}

      {done && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
          Registrado 🌿
        </p>
      )}
    </section>
  );
}
