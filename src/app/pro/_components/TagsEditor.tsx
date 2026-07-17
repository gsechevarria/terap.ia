"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePatientTagsAction } from "@/lib/actions/patients";

export function TagsEditor({
  patientId,
  tags,
}: {
  patientId: string;
  tags: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tags.join(", "));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const parsed = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      await updatePatientTagsAction(patientId, parsed);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <span className="text-xs text-neutral-400">Sin etiquetas</span>
        ) : (
          tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-black/[.05] px-2 py-0.5 text-xs text-neutral-600 dark:bg-white/[.08] dark:text-neutral-300"
            >
              {t}
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          editar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ansiedad, quincenal"
        className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/[.16]"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(tags.join(", "));
          setEditing(false);
        }}
        className="text-xs text-neutral-500 underline"
      >
        cancelar
      </button>
    </div>
  );
}
