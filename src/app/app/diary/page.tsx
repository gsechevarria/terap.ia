import Link from "next/link";
import { getMyMoodEntries } from "@/lib/queries/wellbeing";
import { MoodLogger } from "@/app/app/_components/MoodLogger";
import { ScoreChart } from "@/app/pro/_components/ScoreChart";
import { formatDate } from "@/lib/format";

export default async function PatientDiaryPage() {
  const entries = await getMyMoodEntries();
  const points = [...entries]
    .reverse()
    .map((e) => ({ date: e.entry_date, score: e.mood_value, severity: null }));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <Link href="/app" className="text-sm text-ink-3 hover:text-ink">
        ← Inicio
      </Link>

      <MoodLogger />

      {entries.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Tu evolución (1-5)</h2>
          <ScoreChart points={points} max={5} severity={[]} title="Ánimo" />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold">Tu historial</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-ink-2">Aún no has registrado tu ánimo.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">{e.mood_value}/5</span>
                  {e.note && <p className="mt-1 text-sm text-ink-2">{e.note}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-3">
                  {formatDate(e.entry_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
