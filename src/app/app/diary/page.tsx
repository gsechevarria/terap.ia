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
      <Link href="/app" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>

      <MoodLogger />

      {entries.length > 0 && (
        <section className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
          <h2 className="mb-3 text-sm font-semibold">Tu evolución (1-5)</h2>
          <ScoreChart points={points} max={5} severity={[]} title="Ánimo" />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Tu historial</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Aún no has registrado tu ánimo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
              >
                <div>
                  <span className="font-medium">{e.mood_value}/5</span>
                  {e.note && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                      {e.note}
                    </p>
                  )}
                </div>
                <span className="text-xs text-neutral-400">
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
