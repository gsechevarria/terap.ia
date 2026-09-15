import { Lora, Manrope } from "next/font/google";

/**
 * Tipografías de la landing aprobada.
 *
 * La entrega las pedía a Google Fonts desde un `@import` del CSS. Aquí eso no
 * funcionaría ni convendría: la CSP del repositorio es `style-src 'self'` y
 * `font-src 'self'`, así que la petición se bloquearía y la portada caería a
 * las tipografías de respaldo. `next/font` las auto-hospeda en el build, con lo
 * que el aspecto aprobado se conserva Y se mantiene la decisión del proyecto de
 * que ninguna visita viaje a un tercero.
 *
 * Se declaran aquí y no en el layout raíz para que solo se descarguen en la
 * portada: el panel y la app del paciente no usan ninguna de las dos.
 */
export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--fuente-manrope",
  display: "swap",
});

/** Solo cursiva: en el diseño, Lora aparece únicamente dentro de `<em>`. */
export const lora = Lora({
  subsets: ["latin"],
  style: ["italic"],
  variable: "--fuente-lora",
  display: "swap",
});
