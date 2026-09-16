"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Devuelve la zona de desplazamiento al principio en cada navegación.
 *
 * Next restaura el desplazamiento de la VENTANA, y aquí quien desplaza es un
 * contenedor interno (`.tp-scroll`, el armazón de alto fijo). Sin esto, quien
 * está al final del historial del diario y toca "Citas" aterriza a media
 * pantalla en la lista nueva.
 */
export function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    document.getElementById("tp-scroll")?.scrollTo({ top: 0 });
  }, [pathname]);

  return null;
}
