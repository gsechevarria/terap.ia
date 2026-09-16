"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { addMoodEntryAction } from "@/lib/actions/mood";
import { useAction } from "@/lib/use-action";
import { MoodScale } from "@/app/app/_components/MoodScale";

/**
 * Compositor del diario: ánimo y texto antes que cualquier visualización.
 *
 * A diferencia del check-in del inicio, aquí se guarda con un botón explícito,
 * porque hay una nota que terminar de escribir. "Guardado" aparece SOLO cuando
 * la acción ha resuelto bien; el aviso se retira a los pocos segundos para que
 * no quede afirmando algo de hace media hora.
 */
export function MoodComposer({
  hoy,
  fechaHoy,
}: {
  hoy?: { mood_value: number; note: string | null } | null;
  /** "Hoy, 15 sept" — formateado en servidor, en hora española. */
  fechaHoy: string;
}) {
  const [valor, setValor] = useState<number | null>(hoy?.mood_value ?? null);
  const [nota, setNota] = useState(hoy?.note ?? "");
  const [guardado, setGuardado] = useState(false);
  const { run, pending, error } = useAction();

  // Sin este cleanup el temporizador sobrevive al desmontaje y React avisa de
  // un setState sobre un componente que ya no existe.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  function guardar() {
    if (valor == null) return;
    run(
      () => callAction(addMoodEntryAction, valor, nota),
      () => {
        setGuardado(true);
        if (temporizador.current) clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => setGuardado(false), 4000);
      },
    );
  }

  return (
    <article className="tp-composer">
      <div className="tp-composer-top">
        <h2>¿Cómo te sientes?</h2>
        <span>{fechaHoy}</span>
      </div>

      <MoodScale
        valor={valor}
        onElegir={(v) => {
          setValor(v);
          setGuardado(false);
        }}
        disabled={pending}
        etiquetaGrupo="Cómo te sientes hoy"
      />

      <label className="tp-label" htmlFor="tp-diary-note">
        Ponle palabras
        <span>Opcional</span>
      </label>
      <textarea
        id="tp-diary-note"
        className="tp-textarea"
        rows={4}
        maxLength={5000}
        value={nota}
        onChange={(e) => {
          setNota(e.target.value);
          setGuardado(false);
        }}
        placeholder="Hoy me he sentido…"
      />

      {error && <p className="tp-inline-error">{error}</p>}

      {guardado && (
        <p className="tp-composer-status" role="status">
          <Check size={17} strokeWidth={2.2} aria-hidden />
          Guardado en tu diario
        </p>
      )}

      <button
        type="button"
        className="tp-primary tp-wide"
        onClick={guardar}
        disabled={pending || valor == null}
      >
        {pending
          ? "Guardando…"
          : hoy
            ? "Actualizar mi momento"
            : "Guardar momento"}
        {!pending && <ArrowRight size={19} strokeWidth={1.9} aria-hidden />}
      </button>

      {valor == null && (
        <p className="tp-section-desc">Elige cómo te sientes para poder guardar.</p>
      )}
    </article>
  );
}
