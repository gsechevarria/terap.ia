"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ProNav } from "@/app/pro/_components/ProNav";
import { MarcaTerap } from "@/components/ui/MarcaTerap";

/**
 * Barra lateral en forma de cajón, por debajo de 1024 px.
 *
 * El contenido es el MISMO `ProNav` del escritorio, no una copia: una segunda
 * lista de enlaces se desincroniza a la primera oportunidad.
 *
 * Se cierra solo al navegar (efecto sobre `pathname`) y con Escape. Mientras
 * está abierto se bloquea el desplazamiento del documento, o el cajón se queda
 * quieto y la página de debajo se mueve.
 */
export function CajonNavegacion({
  pendingRequests,
  patientCount,
  esAdmin = false,
  children,
}: {
  pendingRequests: number;
  patientCount: number;
  /** Muestra la entrada de administración de plataforma. */
  esAdmin?: boolean;
  /** Pie del cajón: identidad y conmutador de aspecto. */
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const [rutaAlAbrir, setRutaAlAbrir] = useState(pathname);

  // Cerrar al navegar se AJUSTA DURANTE EL RENDER, no en un efecto: un efecto
  // que llama a `setState` provoca un segundo render en cascada y, además, el
  // cajón llegaría a pintarse una vez sobre la pantalla nueva antes de
  // cerrarse. React descarta este render y vuelve a empezar con el estado ya
  // corregido, así que no llega a verse.
  if (pathname !== rutaAlAbrir) {
    setRutaAlAbrir(pathname);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alPulsar);
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir navegación"
        aria-expanded={abierto}
        className="flex size-9 items-center justify-center rounded-xl bg-surface-muted text-ink lg:hidden"
      >
        <Menu size={18} strokeWidth={1.7} aria-hidden />
      </button>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-ink/35"
          />
          <div className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] flex-col gap-4 bg-canvas p-4">
            <div className="flex items-center justify-between">
              <span className="text-ink">
                <MarcaTerap tamano={20} />
              </span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar navegación"
                className="flex size-9 items-center justify-center rounded-xl text-ink-2 hover:bg-surface"
              >
                <X size={18} strokeWidth={1.7} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProNav
                pendingRequests={pendingRequests}
                patientCount={patientCount}
                esAdmin={esAdmin}
              />
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
