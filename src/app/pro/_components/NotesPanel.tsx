"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNoteAction, deleteNoteAction } from "@/lib/actions/notes";
import { formatDateTime } from "@/lib/format";
import type { PatientNote } from "@/lib/types";

export function NotesPanel({
  patientId,
  notes,
}: {
  patientId: string;
  notes: PatientNote[];
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);

  function add() {
    if (!value.trim()) return;
    startTransition(async () => {
      await addNoteAction(patientId, value);
      setValue("");
      router.refresh();
      ref.current?.focus();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteNoteAction(id, patientId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder="Nota rápida (privada, solo tú la ves)…"
          className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !value.trim()}
          className="self-start rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          Añadir nota
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin notas todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
            >
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {formatDateTime(n.created_at)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  disabled={pending}
                  className="text-xs text-neutral-500 underline hover:text-red-600 disabled:opacity-60"
                >
                  eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
