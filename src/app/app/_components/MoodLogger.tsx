"use client";

import { useState, useTransition, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Angry, Frown, Meh, Smile, Laugh, Check } from "lucide-react";
import { addMoodEntryAction } from "@/lib/actions/mood";

type Face = { value: number; Icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string };

const FACES: Face[] = [
  { value: 1, Icon: Angry, label: "Muy mal" },
  { value: 2, Icon: Frown, label: "Mal" },
  { value: 3, Icon: Meh, label: "Normal" },
  { value: 4, Icon: Smile, label: "Bien" },
  { value: 5, Icon: Laugh, label: "Muy bien" },
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
      <div className="mt-3 flex justify-between gap-1.5">
        {FACES.map(({ value: v, Icon, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setValue(v)}
            aria-label={label}
            aria-pressed={value === v}
            className={`flex min-h-11 flex-1 cursor-pointer flex-col items-center gap-1 rounded-md border py-2 transition-colors duration-150 ${
              value === v
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-3 hover:bg-wash hover:text-ink-2"
            }`}
          >
            <Icon className="size-6" strokeWidth={1.75} />
            <span className="text-[10px] font-medium">{label}</span>
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

      {done && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent">
          <Check className="size-4" strokeWidth={2.5} /> Registrado
        </p>
      )}
    </section>
  );
}
