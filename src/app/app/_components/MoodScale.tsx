"use client";

import { useId } from "react";
import { Frown, Meh, Smile, Laugh, type LucideIcon } from "lucide-react";
import {
  ESCALA_ACTUAL,
  OPCIONES_ACTUALES,
  nombreAccesible,
} from "@/lib/diario";

/**
 * Las cuatro caras. Del icono ya instalado (`lucide-react`), que distingue los
 * cuatro estados sin ambigüedad: no hace falta una dependencia nueva ni dibujar
 * SVG a mano.
 */
const ICONOS: Record<number, LucideIcon> = {
  1: Frown, // Mal
  2: Meh, // Regular
  3: Smile, // Bien
  4: Laugh, // Muy bien
};

/**
 * Selector de ánimo, compartido por Inicio y Diario.
 *
 * Son **radios nativos** y no botones, y la diferencia no es de estilo:
 *
 *  · La selección única la impone el navegador, no una variable nuestra.
 *  · Las flechas del teclado recorren el grupo y la barra espaciadora elige,
 *    gratis y en todos los lectores de pantalla.
 *  · El lector anuncia «opción 2 de 4», que es la información que al icono le
 *    falta.
 *
 * El `<input>` está oculto visualmente pero **no** para la accesibilidad, y la
 * etiqueta entera es el área pulsable: 4 columnas caben a 320 px con más de
 * 44 px de lado.
 *
 * La selección NO se expresa solo con color —cambia el relleno del círculo,
 * aparece un cerco y la etiqueta pasa a negrita—, porque un daltónico tiene el
 * mismo derecho a saber qué ha marcado.
 *
 * Sin opción marcada por defecto: que la pantalla proponga «Bien» antes de que
 * la persona diga nada es ponerle palabras en la boca.
 */
export function MoodScale({
  valor,
  onElegir,
  disabled = false,
  etiquetaGrupo = "Cómo te sientes hoy",
}: {
  valor: number | null;
  onElegir: (valor: number) => void;
  disabled?: boolean;
  etiquetaGrupo?: string;
}) {
  const grupo = useId();

  return (
    <fieldset className="tp-mood-fieldset" disabled={disabled}>
      <legend className="tp-sr-only">{etiquetaGrupo}</legend>
      <div className="tp-mood-row">
        {OPCIONES_ACTUALES.map(({ valor: v, etiqueta }) => {
          const Icono = ICONOS[v]!;
          return (
            <label key={v} className="tp-mood-choice">
              <input
                className="tp-mood-input"
                type="radio"
                name={grupo}
                value={v}
                checked={valor === v}
                onChange={() => onElegir(v)}
                aria-label={nombreAccesible(v, ESCALA_ACTUAL)}
              />
              <span className="tp-mood-icon">
                <Icono size={28} strokeWidth={valor === v ? 1.9 : 1.4} aria-hidden />
              </span>
              <span className="tp-mood-label">{etiqueta}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
