"use client";

import { useRef, useState } from "react";
import { Eye } from "lucide-react";
import {
  addDocumentAction,
  deleteDocumentAction,
  setDocumentSharedAction,
} from "@/lib/actions/documents";
import { formatDate } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { DocumentRow } from "@/lib/types";

export function DocumentsPanel({
  patientId,
  documents,
}: {
  patientId: string;
  documents: DocumentRow[];
}) {
  const { run, pending, error, setError } = useAction();
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
          <label className="block">
            <span className="field-label">Título (opcional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (opcional)"
              className="field"
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="field-label">Archivo</span>
              <input ref={fileRef} type="file" className="text-sm text-ink-2" />
            </label>
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

      <p className="text-xs text-ink-2">
        Los documentos <strong className="font-medium">no se comparten</strong>{" "}
        con el paciente salvo que lo marques. Recuerda que la Ley 41/2002
        (art. 18.3) excluye del acceso del paciente tus anotaciones subjetivas y
        los datos de terceros.
      </p>

      {documents.length === 0 ? (
        <p className="text-sm text-ink-2">Sin documentos.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {documents.map((d) => (
            <li
              key={d.id}
              className="group flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="min-w-0">
                {d.title ?? "Documento"}
                <span className="ml-2 text-xs text-ink-3">
                  {formatDate(d.created_at)}
                </span>
                {d.shared_with_patient && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-accent">
                    <Eye className="size-3.5" aria-hidden />
                    visible para el paciente
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
                  <input
                    type="checkbox"
                    checked={d.shared_with_patient}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        setDocumentSharedAction(d.id, patientId, e.target.checked),
                      )
                    }
                  />
                  Compartir
                </label>
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
