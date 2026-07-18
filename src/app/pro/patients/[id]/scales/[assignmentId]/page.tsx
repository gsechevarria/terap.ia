import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssignmentDetail } from "@/lib/queries/scales";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import { formatDateTime } from "@/lib/format";

export default async function ScaleEvolutionPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;
  const detail = await getAssignmentDetail(assignmentId);
  if (!detail || detail.patientId !== id) notFound();

  const scored = detail.responses.filter((r) => r.score != null);
  const points = scored.map((r) => ({
    date: r.submitted_at,
    score: r.score as number,
    severity: r.severity,
  }));
  const flaggedCount = detail.responses.filter((r) => r.flagged).length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/pro/patients/${id}?tab=escalas`}
        className="text-sm text-ink-3 hover:text-ink"
      >
        ← Escalas del paciente
      </Link>
      <h1 className="page-title mt-3">
        {detail.scaleCode}
        <span className="ml-2 text-base font-normal text-ink-2">
          {detail.scaleName}
        </span>
      </h1>

      {flaggedCount > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded border border-danger/25 bg-danger-soft p-4 text-sm text-danger">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-danger" />
          <p>
            {flaggedCount} respuesta{flaggedCount > 1 ? "s" : ""} con el ítem de
            riesgo marcado. Revisa el histórico y contacta con el paciente según
            tu criterio profesional.
          </p>
        </div>
      )}

      {points.length === 0 ? (
        <p className="mt-6 text-sm text-ink-2">
          Aún no hay respuestas para esta escala.
        </p>
      ) : (
        <>
          <div className="card mt-6 p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Evolución de la puntuación
            </h2>
            <ScoreChart
              points={points}
              max={detail.definition.scoring.max}
              severity={detail.definition.scoring.severity}
              title={detail.scaleCode}
            />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Respuestas ({detail.responses.length})
            </h2>
            <a
              href={`/pro/patients/${id}/scales/${assignmentId}/export`}
              className="btn-ghost"
            >
              Exportar CSV
            </a>
          </div>

          <div className="card mt-3 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Puntuación</th>
                  <th>Severidad</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {[...detail.responses].reverse().map((r) => (
                  <tr key={r.id} className="last:[&>td]:border-b-0">
                    <td>{formatDateTime(r.submitted_at)}</td>
                    <td className="font-medium">{r.score}</td>
                    <td className="text-ink-2">{r.severity ?? "—"}</td>
                    <td>
                      {r.flagged ? (
                        <span className="rounded-sm bg-danger-soft px-1.5 py-px text-xs font-semibold text-danger">
                          riesgo
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
