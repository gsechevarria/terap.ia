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
        className="text-sm text-neutral-500 hover:underline"
      >
        ← Escalas del paciente
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {detail.scaleCode}
        <span className="ml-2 text-base font-normal text-neutral-500">
          {detail.scaleName}
        </span>
      </h1>

      {flaggedCount > 0 && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          ⚠️ {flaggedCount} respuesta{flaggedCount > 1 ? "s" : ""} con el ítem de
          riesgo marcado. Revisa el histórico y contacta con el paciente según tu
          criterio profesional.
        </div>
      )}

      {points.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Aún no hay respuestas para esta escala.
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
            <h2 className="mb-3 text-sm font-semibold">Evolución de la puntuación</h2>
            <ScoreChart
              points={points}
              max={detail.definition.scoring.max}
              severity={detail.definition.scoring.severity}
              title={detail.scaleCode}
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Respuestas ({detail.responses.length})</h2>
            <a
              href={`/pro/patients/${id}/scales/${assignmentId}/export`}
              className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
            >
              Exportar CSV
            </a>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-neutral-500 dark:border-white/[.12]">
                  <th className="py-2 pr-4 font-medium">Fecha</th>
                  <th className="py-2 pr-4 font-medium">Puntuación</th>
                  <th className="py-2 pr-4 font-medium">Severidad</th>
                  <th className="py-2 font-medium">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {[...detail.responses].reverse().map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-black/[.05] dark:border-white/[.08]"
                  >
                    <td className="py-2 pr-4">{formatDateTime(r.submitted_at)}</td>
                    <td className="py-2 pr-4 font-medium">{r.score}</td>
                    <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-300">
                      {r.severity ?? "—"}
                    </td>
                    <td className="py-2">
                      {r.flagged ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
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
