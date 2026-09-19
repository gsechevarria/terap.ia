"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { actionErrorMessage } from "@/lib/errors";
import { addMoodEntryAction } from "@/lib/actions/mood";
import { ESCALA_ACTUAL, LIMITE_NOTA } from "@/lib/diario";
import { MoodScale } from "@/app/app/_components/MoodScale";
import { CONFIRMACION_GUARDADO, mensajeDeApoyo } from "@/app/app/_ui/apoyo";

/**
 * El registro del día: cuatro caras, una nota opcional y un botón.
 *
 * **Uno solo para Inicio y para Diario.** Antes eran dos: el inicio guardaba
 * al tocar una cara y el diario tenía compositor con nota. Mantener dos
 * caminos hacia la misma fila significaba dos sitios donde equivocarse con la
 * escala, con el límite de la nota y con el mensaje de apoyo.
 *
 * Tres cosas que no son cosméticas:
 *
 *  · **Un fallo no borra lo escrito.** Si el guardado falla, la cara elegida y
 *    la nota se quedan donde están para reintentar. Es lo contrario de lo que
 *    hacía el check-in anterior, que revertía la selección — allí tenía
 *    sentido, porque guardaba solo al tocar y dejar la cara marcada habría
 *    afirmado un registro que el servidor no aceptó. Aquí hay un botón: lo que
 *    se ve es un borrador, no una afirmación.
 *
 *  · **Nada se guarda en el navegador.** Ni `localStorage` ni `IndexedDB`: son
 *    notas clínicas y el dispositivo puede ser compartido. Viven en la memoria
 *    de la pantalla mientras está abierta, y ya.
 *
 *  · **El mensaje de apoyo no es estado.** Se deriva de la opción y del día
 *    con una función pura, así que no puede cambiar al escribir, ni al volver
 *    a renderizar, ni al reintentar. Si fuese un `useState` con un aleatorio,
 *    cada tecla pulsada podría reescribir la frase que la persona está
 *    leyendo.
 */
export function MoodEntryForm({
  hoy,
  dia,
  enlaceAlDiario = false,
}: {
  hoy?: { mood_value: number; mood_scale: number; note: string | null } | null;
  /** 'YYYY-MM-DD' de hoy, resuelto en servidor en hora española. */
  dia: string;
  /** En Inicio, ofrece pasar al diario después de guardar. */
  enlaceAlDiario?: boolean;
}) {
  const router = useRouter();

  // Un registro de hoy hecho con la escala anterior NO se preselecciona: su
  // número significa otra cosa y marcar una cara por él sería ponerle a la
  // persona una respuesta que no dio.
  const registroComparable = hoy && hoy.mood_scale === ESCALA_ACTUAL ? hoy : null;

  const [valor, setValor] = useState<number | null>(registroComparable?.mood_value ?? null);
  const [nota, setNota] = useState(hoy?.note ?? "");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const apoyo = valor == null ? null : mensajeDeApoyo(valor, ESCALA_ACTUAL, dia);
  const restantes = LIMITE_NOTA - nota.length;

  function guardar() {
    if (valor == null || pending) return;
    setError("");
    setGuardado(false);
    startTransition(async () => {
      try {
        await callAction(addMoodEntryAction, valor, nota);
        setGuardado(true);
        router.refresh();
      } catch (e) {
        // Ni la cara ni la nota se tocan: el paciente reintenta sin reescribir.
        setError(actionErrorMessage(e));
      }
    });
  }

  return (
    <article className="tp-composer">
      <div className="tp-composer-top">
        <h2>¿Cómo te sientes hoy?</h2>
      </div>

      <MoodScale
        valor={valor}
        onElegir={(v) => {
          setValor(v);
          setGuardado(false);
        }}
        disabled={pending}
      />

      {/* Aparece al elegir, ANTES de guardar: si alguien marca que está mal y
          se va sin guardar, ya ha leído algo. */}
      {apoyo && (
        <p className="tp-apoyo" role="status">
          {apoyo}
        </p>
      )}

      {hoy && !registroComparable && (
        <p className="tp-section-desc">
          Lo que registraste hoy fue con la escala anterior. Si guardas, se
          sustituye por la nueva.
        </p>
      )}

      <label className="tp-label" htmlFor="tp-diary-note">
        ¿Quieres contar algo más?
        <span>Opcional</span>
      </label>
      <p className="tp-field-help" id="tp-diary-note-help">
        Opcional. Puedes escribir lo que quieras recordar de hoy.
      </p>
      <textarea
        id="tp-diary-note"
        className="tp-textarea"
        rows={4}
        maxLength={LIMITE_NOTA}
        value={nota}
        aria-describedby="tp-diary-note-help tp-diary-note-count tp-diary-note-quien"
        onChange={(e) => {
          setNota(e.target.value);
          setGuardado(false);
        }}
        placeholder="Hoy me he sentido…"
      />
      <p className="tp-field-foot">
        {/* Quién lo lee, según los permisos reales: la política
            `mood_entries_select_by_professional` deja leer el diario al
            profesional con acceso al expediente. No se presenta como privado
            porque no lo es. */}
        <span id="tp-diary-note-quien">Puede leerlo tu profesional.</span>
        <span id="tp-diary-note-count" aria-live="off">
          {restantes.toLocaleString("es-ES")} restantes
        </span>
      </p>

      {error && (
        <p className="tp-inline-error" role="alert">
          {error}
        </p>
      )}

      {guardado && (
        <p className="tp-composer-status" role="status">
          <Check size={17} strokeWidth={2.2} aria-hidden />
          {CONFIRMACION_GUARDADO}
          {enlaceAlDiario && (
            <Link href="/app/diary">
              Ver mi diario
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
            </Link>
          )}
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
          : registroComparable
            ? "Actualizar mi estado"
            : "Guardar mi estado"}
        {!pending && <ArrowRight size={19} strokeWidth={1.9} aria-hidden />}
      </button>

      {valor == null && (
        <p className="tp-section-desc">Elige cómo te sientes para poder guardar.</p>
      )}
    </article>
  );
}
