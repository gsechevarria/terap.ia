import { Download, ExternalLink, FileText, Link2 } from "lucide-react";
import { getMyDocuments, getMyResources } from "@/lib/queries/wellbeing";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Recursos · terap.ia" };

export default async function PatientResourcesPage() {
  const [resources, documents] = await Promise.all([
    getMyResources(),
    getMyDocuments(),
  ]);

  return (
    <>
      <div className="tp-page-heading">
        <p className="tp-overline">De tu profesional</p>
        <div>
          <h1 className="tp-h1">Recursos</h1>
        </div>
      </div>

      {resources.length === 0 ? (
        <p className="tp-empty">
          Tu profesional aún no ha compartido recursos contigo.
        </p>
      ) : (
        <div className="tp-card">
          {resources.map((r) =>
            r.kind === "link" && r.url ? (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tp-list-row"
              >
                <Link2 size={18} strokeWidth={1.7} aria-hidden />
                <span className="tp-list-label">{r.title}</span>
                <ExternalLink
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden
                  className="tp-chevron"
                />
              </a>
            ) : r.storage_path ? (
              <a
                key={r.id}
                href={`/files?path=${encodeURIComponent(r.storage_path)}`}
                className="tp-list-row"
              >
                <FileText size={18} strokeWidth={1.7} aria-hidden />
                <span className="tp-list-label">{r.title}</span>
                <Download
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden
                  className="tp-chevron"
                />
              </a>
            ) : (
              <div key={r.id} className="tp-list-row">
                <FileText size={18} strokeWidth={1.7} aria-hidden />
                <span className="tp-list-label">{r.title}</span>
              </div>
            ),
          )}
        </div>
      )}

      <section className="tp-space-top" aria-labelledby="tp-documentos">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-documentos">
            Documentos
          </h2>
          {documents.length > 0 && (
            <span className="tp-count">{documents.length}</span>
          )}
        </div>

        {documents.length === 0 ? (
          <p className="tp-section-desc">
            Aquí aparecerán los documentos que tu profesional comparta contigo.
          </p>
        ) : (
          <div className="tp-card" style={{ marginTop: 14 }}>
            {documents.map((d) => (
              <a
                key={d.id}
                href={`/files?path=${encodeURIComponent(d.storage_path)}`}
                className="tp-list-row"
              >
                <FileText size={18} strokeWidth={1.7} aria-hidden />
                <span className="tp-list-label">{d.title ?? "Documento"}</span>
                <span className="tp-list-hint">{formatDate(d.created_at)}</span>
                <Download
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden
                  className="tp-chevron"
                />
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
