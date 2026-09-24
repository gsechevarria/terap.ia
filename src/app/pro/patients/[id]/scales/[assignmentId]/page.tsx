import { notFound } from "next/navigation";
import { getAssignmentDetail } from "@/lib/queries/scales";
import { getPatient } from "@/lib/queries/patients";
import { Migas } from "@/app/pro/_components/Migas";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import { StatusCritical } from "@/components/ui/Status";
import { formatDateTime } from "@/lib/format";

export default async function ScaleEvolutionPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;
  const [detail, patient] = await Promise.all([
    getAssignmentDetail(assignmentId),
    getPatient(id),
  ]);
  if (!detail || detail.patientId !== id || !patient) notFound();

  const scored = detail.responses.filter((r) => r.score != null);
  const points = scored.map((r) => ({
    date: r.submitted_at,
    score: r.score as number,
    severity: r.severity,
  }));
  const flaggedCount = detail.responses.filter((r) => r.flagged).length;

  return (
    // A lo ancho; la gráfica se limita sola a su ancho de lectura.
    <div>
      <Migas
        tramos={[
          { href: "/pro/patients", texto: "Pacientes" },
          {
            href: `/pro/patients/${id}?tab=escalas`,
            texto: patient.full_name ?? "Sin nombre",
          },
          { texto: detail.scaleCode },
        ]}
      />
      <h1 className="page-title mt-3">{detail.scaleCode}</h1>
      <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">
        {detail.scaleName}, de {patient.full_name ?? "este paciente"}.{" "}
        {detail.responses.length === 0
          ? "Todavía sin respuestas."
          : `${detail.responses.length} ${detail.responses.length === 1 ? "respuesta" : "respuestas"}.`}
      </p>

      {flaggedCount > 0 && (
        <div role="alert" className="alert-clinical mt-5">
          <span
            aria-hidden
            className="mt-[5px] block size-2 shrink-0 rounded-full"
            style={{
              background: "var(--danger)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--danger) 20%, transparent)",
            }}
          />
          <p className="min-w-0 flex-1">
            <span className="font-semibold text-danger-ink">
              {flaggedCount} respuesta{flaggedCount > 1 ? "s" : ""} con el ítem de
              riesgo marcado.
            </span>{" "}
            Revisa el histórico y contacta con el paciente según tu criterio
            profesional.
          </p>
        </div>
      )}

      {points.length === 0 ? (
        <p className="mt-7 text-[13.5px] text-ink-3">
          Todavía no hay respuestas. Aparecerán aquí en cuanto el paciente conteste.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="section-title">Evolución de la puntuación</h2>
            <div className="mt-4">
              <ScoreChart
                points={points}
                max={detail.definition.scoring.max}
                severity={detail.definition.scoring.severity}
                title={detail.scaleCode}
              />
            </div>
          </section>

          <section className="mt-9 border-t border-line pt-7">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">
                Respuestas{" "}
                <span className="font-normal text-ink-4">
                  {detail.responses.length}
                </span>
              </h2>
              <a
                href={`/pro/patients/${id}/scales/${assignmentId}/export`}
                className="btn-ghost btn-sm"
              >
                Exportar CSV
              </a>
            </div>

            <div className="max-w-3xl">
              <div className="overflow-x-auto">
                <table className="table-base table-plain">
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
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">
                          {formatDateTime(r.submitted_at)}
                        </td>
                        <td className="mono font-medium">{r.score}</td>
                        <td className="text-ink-2">{r.severity ?? "—"}</td>
                        <td>
                          {r.flagged ? (
                            <StatusCritical>riesgo</StatusCritical>
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
