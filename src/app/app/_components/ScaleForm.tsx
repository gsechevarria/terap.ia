"use client";
import { callAction } from "@/lib/action-result";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Phone } from "lucide-react";
import { submitScaleResponseAction } from "@/lib/actions/scale-responses";
import { useAction } from "@/lib/use-action";
import type { ScaleAnswers, ScaleDefinition } from "@/lib/scales";
import type { EmergencyLink } from "@/lib/queries/emergency";

/**
 * Cuestionario del paciente. Solo cambia la piel: la lógica —validación,
 * envío, y sobre todo el hecho de que al paciente NO se le devuelve ni
 * puntuación ni severidad— se conserva exactamente igual.
 */
export function ScaleForm({
  assignmentId,
  scaleId,
  scaleCode,
  scaleName,
  definition,
  emergencyLinks,
}: {
  assignmentId: string;
  scaleId: string;
  scaleCode: string;
  scaleName?: string;
  definition: ScaleDefinition;
  emergencyLinks: EmergencyLink[];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<null | { flagged: boolean }>(null);
  // Sin `refresh`: al enviar se cambia a la pantalla de confirmación, no se
  // recarga la ruta.
  const { run, pending, error, setError } = useAction({ refresh: false });

  const respondidas = definition.items.filter((it) => answers[it.id] != null).length;
  const allAnswered = respondidas === definition.items.length;

  function submit() {
    if (!allAnswered) {
      setError("Responde todas las preguntas.");
      return;
    }
    const payload: ScaleAnswers = {};
    for (const it of definition.items) {
      const v = answers[it.id];
      if (v == null) return; // `allAnswered` ya lo garantiza; el tipo no.
      payload[String(it.id)] = v;
    }

    // El envío va envuelto: si la action lanza (red caída, sesión expirada),
    // el paciente vería la pantalla de error y perdería las 9 respuestas del
    // cuestionario. Así el error se muestra en sitio y las respuestas siguen
    // marcadas para reintentar.
    run(async () => {
      const res = await callAction(submitScaleResponseAction, {
        assignmentId,
        scaleId,
        answers: payload,
      });
      if (res.ok) setResult({ flagged: res.flagged });
      else throw new Error(res.error);
    });
  }

  if (result) {
    return result.flagged ? (
      <section className="tp-alert">
        <h1 className="tp-h1" style={{ fontSize: 26 }}>
          Gracias por compartirlo
        </h1>
        <p>
          Si estás pasando por un momento difícil o piensas en hacerte daño, no
          estás solo. Puedes pedir ayuda ahora mismo:
        </p>
        <div className="tp-emergency-list">
          {emergencyLinks.map((l) =>
            l.phone ? (
              <a key={l.id} href={`tel:${l.phone}`} className="tp-emergency-link">
                <Phone size={18} strokeWidth={1.9} aria-hidden />
                <span>{l.label}</span>
                <strong>{l.phone}</strong>
              </a>
            ) : (
              <span key={l.id} className="tp-emergency-link tp-emergency-plain">
                {l.label}
              </span>
            ),
          )}
        </div>
        <p className="tp-section-desc">
          Tu profesional también podrá verlo y acompañarte.
        </p>
        <Link href="/app" className="tp-secondary tp-wide" style={{ marginTop: 18 }}>
          Volver al inicio
        </Link>
      </section>
    ) : (
      <section className="tp-composer" style={{ textAlign: "center" }}>
        <span className="tp-diary-symbol" style={{ margin: "0 auto 16px" }} aria-hidden>
          <Check size={21} strokeWidth={2} />
        </span>
        <h1 className="tp-h2">Gracias</h1>
        <p className="tp-section-desc">
          Hemos registrado tus respuestas. Tu profesional podrá verlas y las
          comentaréis en la sesión.
        </p>
        <Link href="/app" className="tp-primary tp-wide" style={{ marginTop: 20 }}>
          Volver al inicio
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="tp-page-heading">
        <p className="tp-overline">Te lo ha pedido tu profesional</p>
        <div>
          <h1 className="tp-h1">{scaleCode}</h1>
        </div>
      </div>

      {scaleName && <p className="tp-section-desc" style={{ marginTop: 0 }}>{scaleName}</p>}
      <p className="tp-section-desc">
        Durante las últimas 2 semanas, ¿con qué frecuencia te ha molestado…?
      </p>

      <p className="tp-progress" role="status">
        {respondidas} de {definition.items.length} respondidas
      </p>

      {definition.items.map((it) => (
        <fieldset key={it.id} className="tp-scale-item">
          <legend id={`item-${it.id}-label`}>
            <span aria-hidden>{it.id}.</span> {it.text}
          </legend>
          <div role="radiogroup" aria-labelledby={`item-${it.id}-label`}>
            {definition.options.map((opt) => {
              const marcada = answers[it.id] === opt.value;
              return (
                /* El input real va oculto, así que el foco se dibuja sobre la
                   etiqueta con `has-[:focus-visible]`: quien responde con
                   teclado necesita ver dónde está. */
                <label
                  key={opt.value}
                  className="tp-option"
                  data-checked={marcada ? "true" : undefined}
                >
                  <input
                    type="radio"
                    name={`item-${it.id}`}
                    checked={marcada}
                    onChange={() => setAnswers((a) => ({ ...a, [it.id]: opt.value }))}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {error && (
        <p role="alert" className="tp-inline-error" style={{ marginTop: 18 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !allAnswered}
        className="tp-primary tp-wide"
        style={{ marginTop: 10 }}
      >
        {pending ? "Enviando…" : "Enviar respuestas"}
        {!pending && <ArrowRight size={19} strokeWidth={1.9} aria-hidden />}
      </button>

      {!allAnswered && (
        <p className="tp-section-desc">
          Te faltan {definition.items.length - respondidas}{" "}
          {definition.items.length - respondidas === 1 ? "pregunta" : "preguntas"}.
        </p>
      )}
    </>
  );
}
