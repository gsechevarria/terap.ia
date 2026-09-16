"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { actionErrorMessage } from "@/lib/errors";
import { addMoodEntryAction } from "@/lib/actions/mood";
import { MoodScale, etiquetaAnimo } from "@/app/app/_components/MoodScale";

/**
 * Check-in de ánimo del inicio: un toque y queda registrado.
 *
 * Es el gesto rápido; el diario tiene el compositor completo con nota y botón
 * de guardar. Aquí se guarda al tocar porque encadenar "elige · escribe ·
 * guarda" en la pantalla de entrada era pedir tres pasos para un dato de uno.
 * Es un `upsert` del día, así que corregirlo es tocar otra cara.
 *
 * Dos cosas que no son cosméticas:
 *
 *  · La nota que ya hubiera hoy VIAJA de vuelta en la llamada. Sin eso,
 *    `addMoodEntryAction` la reescribe a `null` y quien había escrito en el
 *    diario por la mañana la perdía por tocar una cara por la tarde.
 *  · Si la llamada falla, la selección VUELVE a donde estaba. Dejar la cara
 *    nueva marcada afirmaría un registro que el servidor no ha aceptado, que
 *    es justo lo que la entrega pide no hacer.
 *
 * No se usa `useAction` porque ese helper no expone el fallo para deshacer.
 */
export function MoodCheckin({
  hoy,
}: {
  hoy?: { mood_value: number; note: string | null } | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState<number | null>(hoy?.mood_value ?? null);
  const [guardado, setGuardado] = useState(!!hoy);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const nota = hoy?.note ?? "";

  function elegir(nuevo: number) {
    const previo = valor;
    setValor(nuevo);
    setGuardado(false);
    setError("");
    startTransition(async () => {
      try {
        await callAction(addMoodEntryAction, nuevo, nota);
        setGuardado(true);
        router.refresh();
      } catch (e) {
        setValor(previo);
        setGuardado(previo != null);
        setError(actionErrorMessage(e));
      }
    });
  }

  return (
    <section className="tp-mood-section" aria-labelledby="tp-animo">
      <div className="tp-section-heading">
        <h2 className="tp-h2" id="tp-animo">
          ¿Cómo estás hoy?
        </h2>
        <span>Tu momento</span>
      </div>

      <MoodScale valor={valor} onElegir={elegir} disabled={pending} />

      <p className="tp-mood-feedback" role="status">
        {error ? (
          <span className="tp-danger-text">{error}</span>
        ) : pending ? (
          <span className="tp-mood-state">Guardando…</span>
        ) : guardado && valor != null ? (
          <>
            <span className="tp-mood-state">
              <Check size={15} strokeWidth={2.2} aria-hidden />
              Registrado: {etiquetaAnimo(valor)}
            </span>
            <Link href="/app/diary">
              Escribir en mi diario
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
            </Link>
          </>
        ) : (
          <span>Marca cómo te sientes. Solo lo ve tu profesional.</span>
        )}
      </p>
    </section>
  );
}
