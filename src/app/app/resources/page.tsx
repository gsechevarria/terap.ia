import Link from "next/link";
import { getMyDocuments, getMyResources } from "@/lib/queries/wellbeing";
import { formatDate } from "@/lib/format";

export default async function PatientResourcesPage() {
  const [resources, documents] = await Promise.all([
    getMyResources(),
    getMyDocuments(),
  ]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8">
      <div>
        <Link href="/app" className="text-sm text-ink-3 hover:text-ink">
          ← Inicio
        </Link>
        <h1 className="page-title mt-3">Recursos</h1>
        <div className="mt-4">
          {resources.length === 0 ? (
            <p className="text-sm text-ink-2">
              Tu profesional aún no ha compartido recursos.
            </p>
          ) : (
            <ul className="card divide-y divide-line">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium">
                    {r.title}
                  </span>
                  {r.kind === "link" && r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-sm font-medium text-accent hover:underline"
                    >
                      Abrir
                    </a>
                  ) : r.storage_path ? (
                    <a
                      href={`/files?path=${encodeURIComponent(r.storage_path)}`}
                      className="shrink-0 text-sm font-medium text-accent hover:underline"
                    >
                      Descargar
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Documentos</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-ink-2">No tienes documentos.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  {d.title ?? "Documento"}
                  <span className="ml-2 text-xs text-ink-3">
                    {formatDate(d.created_at)}
                  </span>
                </span>
                <a
                  href={`/files?path=${encodeURIComponent(d.storage_path)}`}
                  className="shrink-0 text-sm font-medium text-accent hover:underline"
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
