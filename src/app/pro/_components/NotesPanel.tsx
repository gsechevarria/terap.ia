"use client";

import { useRef, useState } from "react";
import { addNoteAction, deleteNoteAction } from "@/lib/actions/notes";
import { formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { PatientNote } from "@/lib/types";

export function NotesPanel({
  patientId,
  notes,
}: {
  patientId: string;
  notes: PatientNote[];
}) {
  const [value, setValue] = useState("");
  const { run, pending, error } = useAction();
  const ref = useRef<HTMLTextAreaElement>(null);

  function add() {
    if (!value.trim()) return;
    // El texto solo se borra si la action ha ido bien: si falla, la nota sigue
    // en el textarea y el profesional puede reintentar sin reescribirla.
    run(
      () => addNoteAction(patientId, value),
      () => {
        setValue("");
        ref.current?.focus();
      },
    );
  }

  function remove(id: string) {
    run(() => deleteNoteAction(id, patientId));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="block">
          <span className="field-label">Nueva nota</span>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            placeholder="Nota rápida (privada, solo tú la ves)…"
            className="field"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={add}
          disabled={pending || !value.trim()}
          className="btn-primary self-start"
        >
          Añadir nota
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-ink-2">Sin notas todavía.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {notes.map((n) => (
            <li key={n.id} className="group p-4">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-ink-3">
                  {formatDateTime(n.created_at)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  disabled={pending}
                  className="btn-danger btn-sm opacity-100 transition-opacity duration-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
