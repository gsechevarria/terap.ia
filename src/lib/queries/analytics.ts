import { ymdInTZ, parseYMD, mondayOfYMD, formatYMD, addDaysYMD } from "@/lib/tz";
import { allRows } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { getPaymentsOverview, type MonthIncome } from "@/lib/queries/payments";
import type { ScaleDefinition } from "@/lib/scales";

export type Analytics = {
  patients: { active: number; archived: number };
  noShow: {
    total: number;
    attended: number;
    noShow: number;
    lateCancel: number;
    rate: number; // 0-1
  };
  occupancyByWeek: { weekStart: string; count: number }[];
  incomeByMonth: MonthIncome[];
  scaleEvolution: {
    code: string;
    max: number;
    points: { date: string; score: number }[];
  }[];
};

function weekStartISO(d: Date): string {
  return formatYMD(mondayOfYMD(parseYMD(ymdInTZ(d))));
}

const WEEKS = 8;

export async function getProfessionalAnalytics(): Promise<Analytics> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  const empty: Analytics = {
    patients: { active: 0, archived: 0 },
    noShow: { total: 0, attended: 0, noShow: 0, lateCancel: 0, rate: 0 },
    occupancyByWeek: [],
    incomeByMonth: [],
    scaleEvolution: [],
  };
  if (!pro) return empty;

  const today = parseYMD(ymdInTZ(new Date()));

  const [patientsRes, apptRes, incomeRes, scaleRes] = await Promise.all([
    allRows(supabase.from("patients").select("status").eq("professional_id", pro.id)),
    allRows(supabase
      .from("appointments")
      .select("starts_at, status, attendance")
      .eq("professional_id", pro.id)),
    getPaymentsOverview(),
    allRows(supabase
      .from("scale_responses")
      .select("score, submitted_at, scales(code, definition)")),
  ]);

  // Pacientes activos / archivados.
  const patients = { active: 0, archived: 0 };
  for (const p of patientsRes.data ?? []) {
    if (p.status === "archived") patients.archived++;
    else patients.active++;
  }

  // No-shows y ocupación.
  const noShow = { total: 0, attended: 0, noShow: 0, lateCancel: 0, rate: 0 };
  const weekBuckets = new Map<string, number>();
  for (let i = WEEKS - 1; i >= 0; i--) {
    weekBuckets.set(formatYMD(mondayOfYMD(addDaysYMD(today, -i * 7))), 0);
  }
  for (const a of apptRes.data ?? []) {
    if (a.attendance === "attended") {
      noShow.attended++;
      noShow.total++;
    } else if (a.attendance === "no_show") {
      noShow.noShow++;
      noShow.total++;
    } else if (a.attendance === "late_cancel") {
      noShow.lateCancel++;
      noShow.total++;
    }
    if (a.status !== "cancelled") {
      const wk = weekStartISO(new Date(a.starts_at));
      if (weekBuckets.has(wk)) weekBuckets.set(wk, (weekBuckets.get(wk) ?? 0) + 1);
    }
  }
  noShow.rate = noShow.total > 0 ? noShow.noShow / noShow.total : 0;
  const occupancyByWeek = [...weekBuckets.entries()].map(([weekStart, count]) => ({
    weekStart,
    count,
  }));

  // Evolución agregada anonimizada de escalas (media por mes).
  type Agg = { max: number; months: Map<string, { sum: number; n: number }> };
  const byScale = new Map<string, Agg>();
  for (const r of scaleRes.data ?? []) {
    if (r.score == null) continue;
    const scale = r.scales as unknown as {
      code: string;
      definition: ScaleDefinition;
    } | null;
    if (!scale) continue;
    const agg =
      byScale.get(scale.code) ??
      { max: scale.definition?.scoring?.max ?? 27, months: new Map() };
    const month = ymdInTZ(new Date(r.submitted_at)).slice(0, 7);
    const cur = agg.months.get(month) ?? { sum: 0, n: 0 };
    cur.sum += r.score;
    cur.n += 1;
    agg.months.set(month, cur);
    byScale.set(scale.code, agg);
  }
  const scaleEvolution = [...byScale.entries()].map(([code, agg]) => ({
    code,
    max: agg.max,
    points: [...agg.months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({
        date: `${month}-01`,
        score: Math.round((v.sum / v.n) * 10) / 10,
      })),
  }));

  return {
    patients,
    noShow,
    occupancyByWeek,
    incomeByMonth: incomeRes.byMonth,
    scaleEvolution,
  };
}
