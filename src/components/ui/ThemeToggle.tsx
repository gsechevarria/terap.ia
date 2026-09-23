"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Aspecto = "system" | "light" | "dark";
const CLAVE = "terapia:aspecto";

/*
 * La fuente de verdad es la clase de <html>, no un estado de React: el script
 * de `layout.tsx` ya la ha puesto antes del primer pintado, así que leerla
 * evita que el conmutador y la página discrepen durante un instante.
 *
 * `useSyncExternalStore` es lo que permite leerla sin escribir estado dentro
 * de un efecto y sin desajuste de hidratación: en el servidor devuelve
 * "system", que es lo que el HTML representa antes de que el script corra.
 */
const oyentes = new Set<() => void>();

function suscribir(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  return () => oyentes.delete(alCambiar);
}

function leerDelDom(): Aspecto {
  const clases = document.documentElement.classList;
  if (clases.contains("dark")) return "dark";
  if (clases.contains("light")) return "light";
  return "system";
}

function enServidor(): Aspecto {
  return "system";
}

const OPCIONES: { valor: Aspecto; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: "light", etiqueta: "Claro", Icono: Sun },
  { valor: "dark", etiqueta: "Oscuro", Icono: Moon },
  { valor: "system", etiqueta: "Sistema", Icono: Monitor },
];

/**
 * Conmutador de aspecto. Escribe `.light` / `.dark` en <html>, que es lo que
 * los tokens miran a través de `color-scheme`; sin clase se sigue la
 * preferencia del sistema, que es el estado inicial.
 */
export function ThemeToggle() {
  const aspecto = useSyncExternalStore(suscribir, leerDelDom, enServidor);

  function elegir(siguiente: Aspecto) {
    const raiz = document.documentElement;
    raiz.classList.remove("light", "dark");
    if (siguiente !== "system") raiz.classList.add(siguiente);
    try {
      if (siguiente === "system") localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, siguiente);
    } catch {
      // Modo privado o almacenamiento bloqueado: la elección vale para esta
      // pestaña aunque no se pueda recordar. No es un error que mostrar.
    }
    for (const avisar of oyentes) avisar();
  }

  return (
    // Sin caja alrededor: en la barra lateral esto va sobre el lienzo, igual
    // que la identidad del pie, y meterlo en un panel propio rompería esa
    // continuidad. Lo único con forma es el segmentado.
    <div className="flex items-center justify-between gap-2 px-2.5">
      <span className="text-[12.5px] font-medium text-ink-3">Aspecto</span>
      <div className="segmented" role="group" aria-label="Aspecto de la interfaz">
        {OPCIONES.map(({ valor, etiqueta, Icono }) => {
          const activo = aspecto === valor;
          return (
            <button
              key={valor}
              type="button"
              title={etiqueta}
              aria-pressed={activo}
              onClick={() => elegir(valor)}
              className={activo ? "text-accent" : undefined}
            >
              <Icono size={15} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{etiqueta}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
