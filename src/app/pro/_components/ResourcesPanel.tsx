"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addResourceFileAction,
  addResourceLinkAction,
  deleteResourceAction,
} from "@/lib/actions/resources";
import type { ResourceRow } from "@/lib/types";

export function ResourcesPanel({
  patientId,
  resources,
}: {
  patientId: string;
  resources: ResourceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkShared, setLinkShared] = useState(false);

  const [fileTitle, setFileTitle] = useState("");
  const [fileKind, setFileKind] = useState<"pdf" | "audio">("pdf");
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

  function addLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    run(async () => {
      await addResourceLinkAction({
        patientId: linkShared ? null : patientId,
        title: linkTitle,
        url: linkUrl,
      });
      setLinkTitle("");
      setLinkUrl("");
    });
  }

  function addFile() {
    const f = fileRef.current?.files?.[0];
    if (!fileTitle.trim() || !f) {
      setError("Título y archivo son obligatorios.");
      return;
    }
    const fd = new FormData();
    fd.append("patientId", patientId);
    fd.append("title", fileTitle);
    fd.append("kind", fileKind);
    fd.append("file", f);
    run(async () => {
      await addResourceFileAction(fd);
      setFileTitle("");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card bg-panel p-4">
        <h3 className="section-label">Compartir un enlace</h3>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Título"
            className="field"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="field"
          />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={linkShared}
              onChange={(e) => setLinkShared(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Compartir con todos mis pacientes
          </label>
          <button
            type="button"
            onClick={addLink}
            disabled={pending}
            className="btn-primary self-start"
          >
            Añadir enlace
          </button>
        </div>
      </div>

      <div className="card bg-panel p-4">
        <h3 className="section-label">Subir archivo (PDF / audio)</h3>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={fileTitle}
            onChange={(e) => setFileTitle(e.target.value)}
            placeholder="Título"
            className="field"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={fileKind}
              onChange={(e) => setFileKind(e.target.value as "pdf" | "audio")}
              className="field w-auto"
            >
              <option value="pdf">PDF</option>
              <option value="audio">Audio</option>
            </select>
            <input ref={fileRef} type="file" className="text-sm text-ink-2" />
            <button
              type="button"
              onClick={addFile}
              disabled={pending}
              className="btn-ghost"
            >
              Subir
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Los archivos se asocian a este paciente.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {resources.length === 0 ? (
        <p className="text-sm text-ink-2">Sin recursos.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {resources.map((r) => (
            <li
              key={r.id}
              className="group flex items-center justify-between px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{r.title}</span>
                <span className="chip ml-2">{r.kind}</span>
                {r.patient_id === null && (
                  <span className="ml-1 rounded-sm bg-info-soft px-1.5 py-px text-xs font-medium text-info">
                    general
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {r.kind === "link" && r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Abrir
                  </a>
                ) : r.storage_path ? (
                  <a
                    href={`/files?path=${encodeURIComponent(r.storage_path)}`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Descargar
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => run(() => deleteResourceAction(r.id, patientId))}
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
