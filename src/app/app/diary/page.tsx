import { NotebookText } from "lucide-react";
import { todayYMD } from "@/lib/tz";
import { getMyMoodEntries } from "@/lib/queries/wellbeing";
import { MoodComposer } from "@/app/app/_components/MoodComposer";
import { WeeklyMood } from "@/app/app/_components/WeeklyMood";
import { fechaCompactaYMD } from "@/app/app/_ui/fechas";
import { etiquetaAnimoTexto } from "@/app/app/_ui/animo";

export const metadata = { title: "Mi diario · terap.ia" };

export default async function PatientDiaryPage() {
  const entries = await getMyMoodEntries();
  const hoy = todayYMD();
  const deHoy = entries.find((e) => e.entry_date === hoy) ?? null;

  return (
    <>
      <div className="tp-page-heading">
        <p className="tp-overline">Un momento para ti</p>
        <div>
          <h1 className="tp-h1">Mi diario</h1>
          <span className="tp-diary-symbol" aria-hidden>
            <NotebookText size={21} strokeWidth={1.6} />
          </span>
        </div>
      </div>

      <MoodComposer hoy={deHoy} fechaHoy={`Hoy, ${fechaCompactaYMD(hoy)}`} />

      <WeeklyMood entries={entries} hoy={hoy} />

      <section className="tp-journal" aria-labelledby="tp-momentos">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-momentos">
            Tus momentos
          </h2>
          {entries.length > 0 && (
            <span>
              {entries.length} {entries.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="tp-empty" style={{ marginTop: 16 }}>
            Aún no has registrado cómo te sientes. Lo que escribas aquí lo ve tu
            profesional.
          </p>
        ) : (
          entries.map((e) => (
            <article key={e.id}>
              <span className="tp-journal-score">
                {e.mood_value}
                <span>/5</span>
              </span>
              <div>
                <div>
                  <strong>{etiquetaAnimoTexto(e.mood_value)}</strong>
                  <time dateTime={e.entry_date}>
                    {fechaCompactaYMD(e.entry_date)}
                  </time>
                </div>
                {e.note && <p>{e.note}</p>}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
