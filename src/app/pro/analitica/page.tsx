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
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">Analítica</h1>
      <p className="mt-1 text-sm text-ink-2">
        Resumen descriptivo de tu consulta.
      </p>

      {/* Tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Pacientes activos" value={String(a.patients.active)} />
        <Tile label="Archivados" value={String(a.patients.archived)} />
        <Tile
          label="Tasa de no-shows"
          value={`${Math.round(a.noShow.rate * 100)}%`}
          hint={`${a.noShow.noShow}/${a.noShow.total || 0}`}
        />
        <Tile label="Citas (8 sem.)" value={String(occupancyTotal)} />
      </div>

      {/* Ocupación semanal */}
      <Section title="Ocupación semanal (últimas 8 semanas)">
        {occupancyTotal === 0 ? (
          <Empty />
        ) : (
          <BarChart
            ariaLabel="Citas por semana"
            data={a.occupancyByWeek.map((w) => ({
              label: weekLabel(w.weekStart),
              value: w.count,
            }))}
          />
        )}
      </Section>

      {/* Ingresos por mes */}
      <Section title="Ingresos por mes">
        {a.incomeByMonth.length === 0 ? (
          <Empty />
        ) : (
          <BarChart
            ariaLabel="Ingresos por mes"
            valueLabel={(n) => formatCurrency(n)}
            data={[...a.incomeByMonth]
              .reverse()
              .map((m) => ({ label: monthLabel(m.month), value: m.paidCents }))}
          />
        )}
      </Section>

      {/* Evolución agregada de escalas */}
      <Section title="Evolución agregada de escalas (media mensual, anónima)">
        {a.scaleEvolution.length === 0 ? (
          <Empty />
        ) : (
          <div className="flex flex-col gap-6">
            {a.scaleEvolution.map((s) => (
              <div key={s.code}>
                <h3 className="mb-2 text-sm font-medium">{s.code}</h3>
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
      </Section>

      <p className="mt-10 text-xs text-ink-3">
        Datos descriptivos y anonimizados; no constituyen interpretación clínica.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-semibold tracking-[-0.01em]">
        {value}
      </div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-2">
      Aún no hay datos suficientes.
    </p>
  );
}
