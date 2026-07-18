"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addResourceFileAction,
  addResourceLinkAction,
  deleteResourceAction,
} from "@/lib/actions/resources";
import type { ResourceRow } from "@/lib/types";

const inputCls =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]";

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
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Compartir un enlace</h3>
        <div className="mt-2 flex flex-col gap-2">
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Título" className={inputCls} />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className={inputCls} />
          <label className="flex items-center gap-2 text-sm text-neutral-500">
            <input type="checkbox" checked={linkShared} onChange={(e) => setLinkShared(e.target.checked)} />
            Compartir con todos mis pacientes
          </label>
          <button type="button" onClick={addLink} disabled={pending} className="self-start rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
            Añadir enlace
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Subir archivo (PDF / audio)</h3>
        <div className="mt-2 flex flex-col gap-2">
          <input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} placeholder="Título" className={inputCls} />
          <div className="flex flex-wrap items-center gap-2">
            <select value={fileKind} onChange={(e) => setFileKind(e.target.value as "pdf" | "audio")} className={inputCls}>
              <option value="pdf">PDF</option>
              <option value="audio">Audio</option>
            </select>
            <input ref={fileRef} type="file" className="text-sm" />
            <button type="button" onClick={addFile} disabled={pending} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium disabled:opacity-60 dark:border-white/[.16]">
              Subir
            </button>
          </div>
          <p className="text-xs text-neutral-400">Los archivos se asocian a este paciente.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {resources.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin recursos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.12]">
              <div className="min-w-0">
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[.08] dark:text-neutral-300">
                  {r.kind}
                </span>
                {r.patient_id === null && (
                  <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    general
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {r.kind === "link" && r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">
                    abrir
                  </a>
                ) : r.storage_path ? (
                  <a href={`/files?path=${encodeURIComponent(r.storage_path)}`} className="text-sky-600 underline">
                    descargar
                  </a>
                ) : null}
                <button type="button" onClick={() => run(() => deleteResourceAction(r.id, patientId))} disabled={pending} className="text-neutral-400 underline hover:text-red-600">
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
