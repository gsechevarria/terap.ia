import { getProfessionalAnalytics } from "@/lib/queries/analytics";
import { BarChart } from "@/app/pro/_components/BarChart";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import { formatCurrency } from "@/lib/format";

function weekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}
function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00`).toLocaleDateString("es-ES", {
    month: "short",
  });
}

export default async function AnalyticsPage() {
  const a = await getProfessionalAnalytics();
  const occupancyTotal = a.occupancyByWeek.reduce((s, w) => s + w.count, 0);

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <h1 className="page-title">Analítica</h1>
        <p className="mt-3 max-w-[500px] text-body-lg text-ink-2">
          Resumen descriptivo de su consulta.
        </p>
      </div>

      {/* Las cuatro cifras, sin caja: separadas por espacio, no por bordes. */}
      <section className="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Pacientes activos"
          valor={String(a.patients.active)}
          pie="con la ficha abierta"
        />
        <Cifra
          rotulo="Pacientes archivados"
          valor={String(a.patients.archived)}
          pie="conservan su histórico"
        />
        <Cifra
          rotulo="No acudieron sin avisar"
          valor={`${Math.round(a.noShow.rate * 100)}%`}
          pie={`${a.noShow.noShow} de ${a.noShow.total} citas con asistencia registrada`}
        />
        <Cifra
          rotulo="Citas en las últimas 8 semanas"
          valor={String(occupancyTotal)}
          pie="sin contar las canceladas"
        />
      </section>

      <Seccion
        titulo="Ocupación semanal"
        descripcion="Citas por semana durante las últimas ocho."
      >
        {occupancyTotal === 0 ? (
          <Vacio>
            Todavía no hay citas en las últimas ocho semanas. Se agendan desde la
            agenda.
          </Vacio>
        ) : (
          <BarChart
            ariaLabel="Citas por semana"
            data={a.occupancyByWeek.map((w) => ({
              label: weekLabel(w.weekStart),
              value: w.count,
            }))}
          />
        )}
      </Seccion>

      <Seccion titulo="Ingresos por mes" descripcion="Solo lo que consta como cobrado.">
        {a.incomeByMonth.length === 0 ? (
          <Vacio>
            Todavía no hay ningún cobro registrado. Los pagos se anotan desde la
            ficha del paciente, en la pestaña Pagos.
          </Vacio>
        ) : (
          <BarChart
            ariaLabel="Ingresos por mes"
            valueLabel={(n) => formatCurrency(n)}
            data={[...a.incomeByMonth]
              .reverse()
              .map((m) => ({ label: monthLabel(m.month), value: m.paidCents }))}
          />
        )}
      </Seccion>

      <Seccion
        titulo="Evolución agregada de escalas"
        descripcion="Media mensual por escala, anónima."
      >
        {a.scaleEvolution.length === 0 ? (
          <Vacio>
            Ninguna escala respondida todavía. Se activan paciente a paciente,
            desde su ficha.
          </Vacio>
        ) : (
          <div className="flex flex-col gap-7">
            {a.scaleEvolution.map((s) => (
              <div key={s.code}>
                <h3 className="mb-2 text-[13.5px] font-semibold text-ink">{s.code}</h3>
                <ScoreChart
                  points={s.points.map((p) => ({
                    date: p.date,
                    score: p.score,
                    severity: null,
                  }))}
                  max={s.max}
                  severity={[]}
                  title={`${s.code} (media)`}
                />
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <p className="text-[12.5px] text-ink-4">
        Datos descriptivos y anonimizados; no constituyen interpretación clínica.
      </p>
    </div>
  );
}

/** Cifra sin caja: rótulo, número y pie. Ver `docs/DESIGN.md`. */
function Cifra({
  rotulo,
  valor,
  pie,
}: {
  rotulo: string;
  valor: string;
  pie: string;
}) {
  return (
    <div>
      <div className="text-[13px] text-ink-3">{rotulo}</div>
      <div className="figure mt-1">{valor}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-2">{pie}</div>
    </div>
  );
}

/** Zona separada por una línea y aire, nunca por otra caja dentro de la hoja. */
function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-[22px]">
      <h2 className="section-title">{titulo}</h2>
      <p className="mt-0.5 text-[13px] text-ink-3">{descripcion}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13.5px] text-ink-3">{children}</p>;
}
