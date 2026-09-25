import { NotebookText } from "lucide-react";
import { todayYMD } from "@/lib/tz";
import { getMyMoodEntries } from "@/lib/queries/wellbeing";
import { MoodEntryForm } from "@/app/app/_components/MoodEntryForm";
import { WeeklyMood } from "@/app/app/_components/WeeklyMood";
import { fechaCompactaYMD } from "@/app/app/_ui/fechas";
import { esEscalaActual, etiquetaAnimo } from "@/lib/diario";

export const metadata = { title: "Mi diario · Terap" };

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

      <MoodEntryForm hoy={deHoy} dia={hoy} />

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
            Aún no has registrado cómo te sientes. Lo que escribas aquí lo puede
            leer tu profesional.
          </p>
        ) : (
          entries.map((e) => (
            <article key={e.id}>
              {/* El número va SIEMPRE con su escala. Enseñar «3» a secas sería
                  ambiguo: en la escala de cinco era «Normal» y en la de cuatro
                  es «Bien». */}
              <span className="tp-journal-score">
                {e.mood_value}
                <span>/{e.mood_scale}</span>
              </span>
              <div>
                <div>
                  <strong>{etiquetaAnimo(e.mood_value, e.mood_scale)}</strong>
                  <time dateTime={e.entry_date}>
                    {fechaCompactaYMD(e.entry_date)}
                  </time>
                </div>
                {!esEscalaActual(e.mood_scale) && (
                  <p className="tp-journal-escala">
                    Registrado con la escala anterior, de {e.mood_scale}{" "}
                    opciones.
                  </p>
                )}
                {e.note && <p>{e.note}</p>}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
