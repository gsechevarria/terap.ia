import Link from "next/link";
import { getMyDocuments, getMyResources } from "@/lib/queries/wellbeing";
import { formatDate } from "@/lib/format";

export default async function PatientResourcesPage() {
  const [resources, documents] = await Promise.all([
    getMyResources(),
    getMyDocuments(),
  ]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <Link href="/app" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>

      <section>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Recursos</h1>
        {resources.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Tu profesional aún no ha compartido recursos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resources.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]"
              >
                <span className="font-medium">{r.title}</span>
                {r.kind === "link" && r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-600 underline"
                  >
                    Abrir
                  </a>
                ) : r.storage_path ? (
                  <a
                    href={`/files?path=${encodeURIComponent(r.storage_path)}`}
                    className="text-sm text-sky-600 underline"
                  >
                    Descargar
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Documentos</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-neutral-500">No tienes documentos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]"
              >
                <span>
                  {d.title ?? "Documento"}
                  <span className="ml-2 text-xs text-neutral-400">
                    {formatDate(d.created_at)}
                  </span>
                </span>
                <a
                  href={`/files?path=${encodeURIComponent(d.storage_path)}`}
                  className="text-sm text-sky-600 underline"
                >
                  Descargar
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
