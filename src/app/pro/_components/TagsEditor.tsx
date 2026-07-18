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
      <div className="group flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <span className="text-xs text-ink-3">Sin etiquetas</span>
        ) : (
          tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-sm px-1 text-xs text-ink-3 opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:bg-wash hover:text-ink focus-visible:opacity-100"
        >
          Editar
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
        className="field h-7 w-auto px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="btn-primary btn-sm"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(tags.join(", "));
          setEditing(false);
        }}
        className="btn-subtle btn-sm"
      >
        Cancelar
      </button>
    </div>
  );
}
