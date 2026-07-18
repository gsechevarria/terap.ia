"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocumentAction, deleteDocumentAction } from "@/lib/actions/documents";
import { formatDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";

export function DocumentsPanel({
  patientId,
  documents,
}: {
  patientId: string;
  documents: DocumentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function run(fn: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error.");
      }
    });
  }

  function upload() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setError("Selecciona un archivo.");
      return;
    }
    const fd = new FormData();
    fd.append("patientId", patientId);
    fd.append("title", title);
    fd.append("file", f);
    run(async () => {
      await addDocumentAction(fd);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Subir documento</h3>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.16]"
          />
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" className="text-sm" />
            <button
              type="button"
              onClick={upload}
              disabled={pending}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              Subir
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin documentos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.12]"
            >
              <span>
                {d.title ?? "Documento"}
                <span className="ml-2 text-xs text-neutral-400">
                  {formatDate(d.created_at)}
                </span>
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={`/files?path=${encodeURIComponent(d.storage_path)}`}
                  className="text-sky-600 underline"
                >
                  descargar
                </a>
                <button
                  type="button"
                  onClick={() => run(() => deleteDocumentAction(d.id, patientId))}
                  disabled={pending}
                  className="text-neutral-400 underline hover:text-red-600"
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
