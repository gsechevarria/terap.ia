"use client";
import { callAction } from "@/lib/action-result";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Angry, Frown, Meh, Smile, Laugh, Check } from "lucide-react";
import { addMoodEntryAction } from "@/lib/actions/mood";
import { useAction } from "@/lib/use-action";

type Face = { value: number; Icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string };

const FACES: Face[] = [
  { value: 1, Icon: Angry, label: "Muy mal" },
  { value: 2, Icon: Frown, label: "Mal" },
  { value: 3, Icon: Meh, label: "Normal" },
  { value: 4, Icon: Smile, label: "Bien" },
  { value: 5, Icon: Laugh, label: "Muy bien" },
];

export function MoodLogger({ today }: { today?: { mood_value: number; note: string | null } | null }) {
  const [value, setValue] = useState<number | null>(today?.mood_value ?? null);
  const [note, setNote] = useState(today?.note ?? "");
  const [saved, setSaved] = useState(!!today);
  const [done, setDone] = useState(false);
  const { run, pending, error } = useAction();

  // El aviso "Registrado" se oculta solo; sin este cleanup, el timer sobrevive
  // al desmontaje y React avisa de un setState sobre un componente muerto.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  function submit() {
    if (value == null) return;
    // La entrada solo se limpia si se ha guardado: si falla, el paciente no
    // pierde ni el ánimo marcado ni la nota que hubiera escrito.
    run(
      () => callAction(addMoodEntryAction, value, note),
      () => {
        setSaved(true);
        setDone(true);
        if (doneTimer.current) clearTimeout(doneTimer.current);
        doneTimer.current = setTimeout(() => setDone(false), 2500);
      },
    );
  }

  return (
    <section className="card p-4">
      <h2 className="text-base font-semibold">¿Cómo estás hoy?</h2>
      {saved && <p className="mt-2 text-sm text-ink-2">Ya has registrado tu ánimo de hoy. Puedes actualizarlo aquí.</p>}
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
            maxLength={5000}
            placeholder="¿Quieres añadir algo? (opcional)"
            aria-label="Nota sobre cómo te sientes (opcional)"
            className="field"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="btn-primary self-start"
          >
            {pending ? "Guardando…" : saved ? "Actualizar" : "Registrar"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {done && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent">
          <Check className="size-4" strokeWidth={2.5} /> Registrado
        </p>
      )}
    </section>
  );
}
