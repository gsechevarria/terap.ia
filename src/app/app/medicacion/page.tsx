import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { getMiMedicacion } from "@/lib/queries/medicacion";
import {
  AVISO_PACIENTE,
  CON_COMIDA_LABEL,
  MOMENTO_LABEL,
  describeFrecuencia,
  describeMomentos,
  pautaDeHoy,
  vigente,
  type Medicamento,
} from "@/lib/medicacion";
import { formatDate } from "@/lib/format";
import { todayYMD } from "@/lib/tz";

export const metadata = { title: "Mi medicación · Terap" };

/*
 * La pauta tal como la ha anotado el profesional, transcrita de lo que indicó
 * el médico del paciente. Solo lectura: aquí no se marca nada ni se cambia
 * nada. Si el módulo no está activado, la base no devuelve la fila y la página
 * lo dice, sin enseñar nada.
 */
export default async function MiMedicacionPage() {
  const datos = await getMiMedicacion();
  const ahora = new Date();
  const hoy = todayYMD(ahora);

  return (
    <>
      <Link href="/app/more" className="tp-back">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Más
      </Link>

      <div className="tp-page-heading">
        <div>
          <h1 className="tp-h1">Mi medicación</h1>
        </div>
      </div>

      {!datos ? (
        <p className="tp-empty">
          Esta sección no está disponible. Si tienes medicación pautada,
          consúltala con tu médico.
        </p>
      ) : datos.requiere_medicacion === false ? (
        <p className="tp-empty">
          Según ha anotado tu profesional, ahora mismo no tienes pauta de
          medicación.
        </p>
      ) : datos.medicamentos.length === 0 ? (
        <p className="tp-empty">Tu profesional todavía no ha anotado tu pauta.</p>
      ) : (
        <Pauta medicamentos={datos.medicamentos} ahora={ahora} hoy={hoy} />
      )}

      {datos && (
        <p className="tp-inline-note tp-space-top" role="note">
          <Info size={16} strokeWidth={1.8} aria-hidden />
          <span>{AVISO_PACIENTE}</span>
        </p>
      )}
    </>
  );
}

function Pauta({
  medicamentos,
  ahora,
  hoy,
}: {
  medicamentos: Medicamento[];
  ahora: Date;
  hoy: string;
}) {
  const deHoy = pautaDeHoy(medicamentos, ahora);
  const actuales = medicamentos.filter((m) => vigente(m, ahora));
  // Anotados con fecha de inicio futura: se enseñan aparte para que no se
  // tomen antes de tiempo. Los ya terminados no se enseñan.
  const proximos = medicamentos.filter(
    (m) => !m.retirada_at && m.fecha_inicio && m.fecha_inicio > hoy,
  );

  return (
    <>
      {deHoy.length > 0 && (
        <section aria-labelledby="tp-med-hoy">
          <div className="tp-section-heading">
            <h2 className="tp-h2" id="tp-med-hoy">Hoy</h2>
          </div>
          <div className="tp-card tp-space-top">
            {deHoy.map((t) => (
              <div key={t.momento} className="tp-list-row">
                <span className="tp-list-label">{MOMENTO_LABEL[t.momento]}</span>
                <span className="tp-list-hint">
                  {t.medicamentos.map((m) => `${m.nombre} · ${m.dosis}`).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {actuales.length > 0 && (
        <section className="tp-space-top" aria-labelledby="tp-med-pauta">
          <div className="tp-section-heading">
            <h2 className="tp-h2" id="tp-med-pauta">Tu pauta</h2>
          </div>
          <div className="tp-stack-sm tp-space-top">
            {actuales.map((m) => (
              <Ficha key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      {proximos.length > 0 && (
        <section className="tp-space-top" aria-labelledby="tp-med-proximos">
          <div className="tp-section-heading">
            <h2 className="tp-h2" id="tp-med-proximos">Más adelante</h2>
          </div>
          <p className="tp-section-desc">Todavía no toca empezarlos.</p>
          <div className="tp-stack-sm tp-space-top">
            {proximos.map((m) => (
              <Ficha key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Ficha({ m }: { m: Medicamento }) {
  const comida =
    m.con_comida !== "indiferente"
      ? CON_COMIDA_LABEL[m.con_comida as keyof typeof CON_COMIDA_LABEL]
      : null;
  return (
    <article className="tp-card tp-card-pad">
      <span className="tp-row-text">
        <strong>{m.nombre}</strong>
        <small>{m.dosis}</small>
      </span>
      <dl className="tp-section-desc">
        <div>
          <dt className="tp-sr-only">Cuándo</dt>
          <dd>
            {describeFrecuencia(m)}
            {m.momentos.length > 0 && <> · {describeMomentos(m)}</>}
            {m.horario && <> · {m.horario}</>}
          </dd>
        </div>
        {comida && (
          <div>
            <dt className="tp-sr-only">Cómo tomarla</dt>
            <dd>{comida}</dd>
          </div>
        )}
        {m.instrucciones && (
          <div>
            <dt className="tp-sr-only">Instrucciones</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{m.instrucciones}</dd>
          </div>
        )}
        <div>
          <dt className="tp-sr-only">Prescripción</dt>
          <dd>
            Indicado por {m.prescrito_por}
            {m.fecha_inicio && <> · desde el {formatDate(m.fecha_inicio)}</>}
            {m.fecha_fin && <> · hasta el {formatDate(m.fecha_fin)}</>}
          </dd>
        </div>
      </dl>
    </article>
  );
}
