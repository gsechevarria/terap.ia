"use client";

import { Angry, Frown, Meh, Smile, Laugh, type LucideIcon } from "lucide-react";
import { ANIMO, etiquetaAnimoTexto } from "@/app/app/_ui/animo";

const ICONOS: Record<number, LucideIcon> = {
  1: Angry,
  2: Frown,
  3: Meh,
  4: Smile,
  5: Laugh,
};

export const CARAS = Object.keys(ICONOS)
  .map(Number)
  .sort((a, b) => a - b)
  .map((valor) => ({
    valor,
    Icono: ICONOS[valor]!,
    etiqueta: ANIMO[valor]!,
  }));

export { etiquetaAnimoTexto as etiquetaAnimo };

/**
 * Selector de ánimo 1-5, compartido por el check-in del inicio y el compositor
 * del diario.
 *
 * La selección NO se expresa solo con color: cambia el relleno del círculo, se
 * añade un cerco y la etiqueta pasa a negrita, y el estado real viaja en
 * `aria-pressed`. El nombre accesible incluye la posición ("Bien, 4 de 5")
 * porque el icono solo no dice en qué punto de la escala está.
 */
export function MoodScale({
  valor,
  onElegir,
  disabled = false,
  etiquetaGrupo = "Seleccionar cómo te sientes",
}: {
  valor: number | null;
  onElegir: (valor: number) => void;
  disabled?: boolean;
  etiquetaGrupo?: string;
}) {
  return (
    <div className="tp-mood-row" role="group" aria-label={etiquetaGrupo}>
      {CARAS.map(({ valor: v, Icono, etiqueta }) => (
        <button
          key={v}
          type="button"
          className="tp-mood-choice"
          aria-pressed={valor === v}
          aria-label={`${etiqueta}, ${v} de 5`}
          disabled={disabled}
          onClick={() => onElegir(v)}
        >
          <span className="tp-mood-icon">
            <Icono size={28} strokeWidth={1.4} aria-hidden />
          </span>
          <span className="tp-mood-label">{etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
