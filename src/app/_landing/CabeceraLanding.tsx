"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Cabecera de la landing con el menú desplegable en móvil.
 *
 * Es el único trozo de la portada que necesita JavaScript. En la entrega venía
 * como `app.js`, con listeners sobre el documento; aquí se traduce al estado y
 * al ciclo de vida de React para que no queden listeners duplicados si la
 * portada se vuelve a montar en una navegación por cliente. El comportamiento
 * es el mismo: alternar, cerrar al pulsar un enlace y cerrar con Escape.
 */
export function CabeceraLanding() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  return (
    <header className="header">
      <a className="brand" href="#" aria-label="Terap inicio">
        <span className="mark">t</span>terap<span className="brand-dot">.</span>
      </a>
      <nav aria-label="Principal" className={abierto ? "open" : undefined}>
        <a href="#plataforma" onClick={() => setAbierto(false)}>
          Funcionalidades
        </a>
        <a href="#seguimiento" onClick={() => setAbierto(false)}>
          Entre sesiones
        </a>
        <a href="#preguntas" onClick={() => setAbierto(false)}>
          Preguntas frecuentes
        </a>
      </nav>
      {/* Destino real comprobado en el repositorio: `/login` es la única
          entrada a la aplicación. No hay alta de profesionales por
          autoservicio —se retiró a propósito en agosto—, así que no existe
          ninguna ruta de registro a la que enlazar. */}
      <Link className="button small outline" href="/login">
        Acceder a Terap <span>↗</span>
      </Link>
      <button
        className="menu"
        aria-expanded={abierto}
        aria-label="Abrir menú"
        onClick={() => setAbierto((v) => !v)}
      >
        ☰
      </button>
    </header>
  );
}
