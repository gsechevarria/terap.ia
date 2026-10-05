"use client";
/*
 * Mantiene al día una pantalla que ya está abierta.
 *
 * Todo en /app y /pro es dinámico y no hay caché de datos, así que cualquier
 * navegación nueva trae lo último. Lo que se quedaba viejo era la pantalla YA
 * ABIERTA: el paciente con la PWA en segundo plano no veía la tarea que acababa
 * de crearle su psicóloga hasta cambiar de sección, y el panel no se enteraba
 * de lo que hacía el paciente (hallazgos H6 y H8 de docs/SINCRONIZACION.md).
 *
 * `router.refresh()` vuelve a pedir el árbol del servidor —layout incluido— y
 * CONSERVA el estado del cliente: lo que se esté escribiendo en un formulario
 * o un diálogo abierto no se pierde. Se dispara:
 *
 *   · al volver a la pestaña o a la app (`visibilitychange`), si ha estado
 *     fuera más de unos segundos;
 *   · al recuperar la conexión (`online`);
 *   · al volver con atrás/adelante desde la caché del navegador (`pageshow`);
 *   · cada pocos minutos mientras la pantalla está a la vista;
 *   · al navegar dentro del área, si el último refresco es de hace más de un
 *     minuto: el layout (contadores de la barra lateral) no se vuelve a pedir
 *     en las navegaciones internas, y se quedaba con los números de la carga.
 *
 * No hay tiempo real a propósito: con esto basta para que nada lleve más de
 * unos minutos desfasado, sin abrir conexiones permanentes ni tocar la base.
 */
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const FUERA_MIN_MS = 10_000;
const NAVEGACION_MIN_MS = 60_000;

export function RefrescoAutomatico({ cadaMs = 120_000 }: { cadaMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const ultimo = useRef(0);
  const ocultoDesde = useRef<number | null>(null);

  useEffect(() => {
    // La carga inicial cuenta como refresco.
    if (ultimo.current === 0) ultimo.current = Date.now();
    const refrescar = () => {
      ultimo.current = Date.now();
      router.refresh();
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") {
        ocultoDesde.current = Date.now();
        return;
      }
      const fuera = ocultoDesde.current ? Date.now() - ocultoDesde.current : 0;
      ocultoDesde.current = null;
      if (fuera >= FUERA_MIN_MS) refrescar();
    };
    const alVolverDeLaCache = (e: PageTransitionEvent) => {
      if (e.persisted) refrescar();
    };
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - ultimo.current >= cadaMs) refrescar();
    }, 15_000);

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("online", refrescar);
    window.addEventListener("pageshow", alVolverDeLaCache);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("online", refrescar);
      window.removeEventListener("pageshow", alVolverDeLaCache);
    };
  }, [router, cadaMs]);

  // Navegación interna: el segmento de página llega fresco, el layout no.
  useEffect(() => {
    if (ultimo.current !== 0 && Date.now() - ultimo.current >= NAVEGACION_MIN_MS) {
      ultimo.current = Date.now();
      router.refresh();
    }
  }, [pathname, router]);

  return null;
}
