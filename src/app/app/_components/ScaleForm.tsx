"use client";
import { callAction } from "@/lib/action-result";

import { useState } from "react";
import Link from "next/link";
import { submitScaleResponseAction } from "@/lib/actions/scale-responses";
import { useAction } from "@/lib/use-action";
import type { ScaleAnswers, ScaleDefinition } from "@/lib/scales";
import type { EmergencyLink } from "@/lib/queries/emergency";

export function ScaleForm({
  assignmentId,
  scaleId,
  scaleCode,
  definition,
  emergencyLinks,
}: {
  assignmentId: string;
  scaleId: string;
  scaleCode: string;
  definition: ScaleDefinition;
  emergencyLinks: EmergencyLink[];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<null | { flagged: boolean }>(null);
  // Sin `refresh`: al enviar se cambia a la pantalla de confirmación, no se
  // recarga la ruta.
  const { run, pending, error, setError } = useAction({ refresh: false });

  const allAnswered = definition.items.every((it) => answers[it.id] != null);

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
    return (
      <div className="mx-auto max-w-md">
        {result.flagged ? (
          <div className="rounded-lg border border-danger/25 bg-danger-soft p-6">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-danger">
              Gracias por compartirlo
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Si estás pasando por un momento difícil o piensas en hacerte daño,
              no estás solo/a. Puedes pedir ayuda ahora mismo:
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {emergencyLinks.map((l) => (
                <li key={l.id}>
                  {l.phone ? (
                    <a
                      href={`tel:${l.phone}`}
                      className="flex items-center justify-between rounded bg-danger px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <span>{l.label}</span>
                      <span>{l.phone}</span>
                    </a>
                  ) : (
                    <span className="block rounded bg-canvas px-4 py-3 text-sm">
                      {l.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-2">
              Tu profesional también podrá verlo y acompañarte.
            </p>
            <Link href="/app" className="btn-ghost mt-5">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-accent/25 bg-accent-soft p-6 text-center">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-accent">
              Gracias
            </h1>
            <p className="mt-2 text-sm text-ink">
              Hemos registrado tus respuestas. Tu profesional podrá verlas.
            </p>
            <Link href="/app" className="btn-primary mt-5">
              Volver al inicio
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">{scaleCode}</h1>
      <p className="mt-1 text-sm text-ink-2">
        Durante las últimas 2 semanas, ¿con qué frecuencia te ha molestado…?
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {definition.items.map((it) => (
          <fieldset key={it.id} className="flex flex-col gap-2">
            <legend id={`item-${it.id}-label`} className="text-sm font-medium">
              {it.id}. {it.text}
            </legend>
            <div
              role="radiogroup"
              aria-labelledby={`item-${it.id}-label`}
              className="flex flex-col gap-1.5"
            >
              {definition.options.map((opt) => {
                const checked = answers[it.id] === opt.value;
                return (
                  /* El input real está oculto (`sr-only`), así que el
                     `:focus-visible` global se aplicaba a algo invisible: quien
                     responde con teclado no veía dónde estaba el foco.
                     Se usa `has-[:focus-visible]` y no `peer-*` porque el input
                     es HIJO del label, no su hermano: `peer` compila a `~` y no
                     llegaría a aplicarse nunca. */
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded border px-3 py-2 text-sm transition-colors duration-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                      checked
                        ? "border-accent bg-accent-soft font-medium text-accent"
                        : "border-line text-ink-2 hover:bg-wash"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`item-${it.id}`}
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [it.id]: opt.value }))
                      }
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !allAnswered}
        className="btn-primary mt-6 h-11 w-full text-[15px]"
      >
        {pending ? "Enviando…" : "Enviar respuestas"}
      </button>
    </div>
  );
}
