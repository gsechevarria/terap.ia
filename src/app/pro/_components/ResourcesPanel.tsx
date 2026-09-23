"use client";
import { callAction } from "@/lib/action-result";

import { uploadFormFile } from "@/lib/upload-client";

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
      await callAction(addResourceLinkAction, {
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
      await uploadFormFile(fd, "file", "files");
      await callAction(addResourceFileAction, fd);
      setFileTitle("");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="section-title mb-3.5">Compartir un enlace</h2>
        <div className="flex max-w-xl flex-col gap-3">
          <label className="block">
            <span className="field-label">Título</span>
            <input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="field-label">Dirección</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="field"
            />
          </label>
          <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
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
      </section>

      <section className="border-t border-line pt-7">
        <h2 className="section-title mb-3.5">Subir un archivo</h2>
        <div className="flex max-w-xl flex-col gap-3">
          <label className="block">
            <span className="field-label">Título</span>
            <input
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              className="field"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="field-label">Tipo</span>
              <select
                value={fileKind}
                onChange={(e) => setFileKind(e.target.value as "pdf" | "audio")}
                className="field w-auto"
              >
                <option value="pdf">PDF</option>
                <option value="audio">Audio</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">Archivo</span>
              <input ref={fileRef} type="file" className="text-[13px] text-ink-2" />
            </label>
            <button
              type="button"
              onClick={addFile}
              disabled={pending}
              className="btn-ghost"
            >
              Subir
            </button>
          </div>
          <p className="text-[12.5px] text-ink-3">
            Los archivos se asocian a este paciente.
          </p>
        </div>
      </section>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <section className="border-t border-line pt-7">
        <h2 className="section-title mb-1">Recursos compartidos</h2>
        {resources.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink-3">
            Todavía no has compartido nada. Añade un enlace o sube un archivo
            arriba.
          </p>
        ) : (
          <ul>
            {resources.map((r) => (
              <li
                key={r.id}
                className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line-soft py-3.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[13.5px] font-medium">{r.title}</span>
                  <span className="chip">{r.kind}</span>
                  {r.patient_id === null && <span className="chip">general</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {r.kind === "link" && r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium text-accent hover:underline"
                    >
                      Abrir
                    </a>
                  ) : r.storage_path ? (
                    <a
                      href={`/files?path=${encodeURIComponent(r.storage_path)}`}
                      className="text-[13px] font-medium text-accent hover:underline"
                    >
                      Descargar
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => run(() => callAction(deleteResourceAction, r.id, patientId))}
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
      </section>
    </div>
  );
}
