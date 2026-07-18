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
      <div className="card bg-panel p-4">
        <h3 className="section-label">Subir documento</h3>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="field"
          />
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" className="text-sm text-ink-2" />
            <button
              type="button"
              onClick={upload}
              disabled={pending}
              className="btn-primary"
            >
              Subir
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-ink-2">Sin documentos.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {documents.map((d) => (
            <li
              key={d.id}
              className="group flex items-center justify-between px-4 py-3 text-sm"
            >
              <span>
                {d.title ?? "Documento"}
                <span className="ml-2 text-xs text-ink-3">
                  {formatDate(d.created_at)}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <a
                  href={`/files?path=${encodeURIComponent(d.storage_path)}`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => run(() => deleteDocumentAction(d.id, patientId))}
                  disabled={pending}
                  className="btn-danger btn-sm opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
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
