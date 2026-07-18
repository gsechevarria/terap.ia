"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitScaleResponseAction } from "@/lib/actions/scale-responses";
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
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | { flagged: boolean }>(null);
  const [pending, startTransition] = useTransition();

  const allAnswered = definition.items.every((it) => answers[it.id] != null);

  function submit() {
    if (!allAnswered) {
      setError("Responde todas las preguntas.");
      return;
    }
    setError("");
    const payload: ScaleAnswers = {};
    for (const it of definition.items) payload[String(it.id)] = answers[it.id];

    startTransition(async () => {
      const res = await submitScaleResponseAction({
        assignmentId,
        scaleId,
        answers: payload,
      });
      if (res.ok) setResult({ flagged: res.flagged });
      else setError(res.error);
    });
  }

  if (result) {
    return (
      <div className="mx-auto max-w-md">
        {result.flagged ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
            <h1 className="text-xl font-semibold text-red-800 dark:text-red-200">
              Gracias por compartirlo
            </h1>
            <p className="mt-2 text-sm text-red-800 dark:text-red-200">
              Si estás pasando por un momento difícil o piensas en hacerte daño,
              no estás solo/a. Puedes pedir ayuda ahora mismo:
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {emergencyLinks.map((l) => (
                <li key={l.id}>
                  {l.phone ? (
                    <a
                      href={`tel:${l.phone}`}
                      className="flex items-center justify-between rounded-lg bg-red-600 px-4 py-3 font-semibold text-white"
                    >
                      <span>{l.label}</span>
                      <span>{l.phone}</span>
                    </a>
                  ) : (
                    <span className="block rounded-lg bg-white/60 px-4 py-3 text-sm dark:bg-white/10">
                      {l.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-red-700 dark:text-red-300">
              Tu profesional también podrá verlo y acompañarte.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-flex rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 dark:border-red-800 dark:text-red-200"
            >
              Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950">
            <h1 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
              Gracias 🌿
            </h1>
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
              Hemos registrado tus respuestas. Tu profesional podrá verlas.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            >
              Volver al inicio
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight">{scaleCode}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Durante las últimas 2 semanas, ¿con qué frecuencia te ha molestado…?
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {definition.items.map((it) => (
          <fieldset key={it.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              {it.id}. {it.text}
            </legend>
            <div className="flex flex-col gap-1.5">
              {definition.options.map((opt) => {
                const checked = answers[it.id] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-black/[.12] hover:bg-black/[.03] dark:border-white/[.16] dark:hover:bg-white/[.06]"
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
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !allAnswered}
        className="mt-5 w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Enviando…" : "Enviar respuestas"}
      </button>
    </div>
  );
}
