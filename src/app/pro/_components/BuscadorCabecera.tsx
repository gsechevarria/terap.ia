"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Buscador de la cabecera del panel.
 *
 * Es distinto del buscador del listado (`PatientSearch`), y a propósito. Aquel
 * filtra EN SITIO, reescribiendo `?q=` sobre la ruta actual; este vive en el
 * shell, se ve desde cualquier pantalla y no tendría dónde filtrar: desde la
 * agenda o desde contabilidad, escribir un `?q=` en la URL no lo leería nadie.
 * Así que este NAVEGA al listado de pacientes con el término puesto.
 *
 * Por eso tampoco lleva rebote de 250 ms: no se busca mientras escribes, se
 * busca al enviar. Un rebote aquí dispararía una navegación por cada pausa al
 * teclear.
 *
 * Busca lo que sabe buscar la consulta que hay detrás —nombre, correo, teléfono
 * y profesión de un paciente—, así que el rótulo dice «paciente» y no «buscar»
 * a secas: prometer una búsqueda global que no existe es peor que no tenerla.
 */
export function BuscadorCabecera() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState("");

  // Ctrl/⌘ + K enfoca. No secuestra la tecla si ya se está escribiendo en otro
  // campo: dentro de un formulario, Ctrl+K sigue siendo del navegador.
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key !== "k" || !(e.ctrlKey || e.metaKey)) return;
      const activo = document.activeElement;
      if (activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement) {
        if (activo !== input.current) return;
      }
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const termino = valor.trim();
        router.push(termino ? `/pro/patients?q=${encodeURIComponent(termino)}` : "/pro/patients");
      }}
      className="flex h-9 w-[300px] items-center gap-2 rounded-xl bg-surface-muted px-3"
    >
      <Search size={15} strokeWidth={2} className="shrink-0 text-ink-4" aria-hidden />
      <input
        ref={input}
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar paciente"
        aria-label="Buscar paciente por nombre, correo, teléfono o profesión"
        className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd
        aria-hidden
        className="shrink-0 text-[11.5px] font-normal text-ink-3"
      >
        Ctrl K
      </kbd>
    </form>
  );
}
