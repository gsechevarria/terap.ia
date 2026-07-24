"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Buscador de pacientes. Actualiza el parámetro `q` en la URL (con debounce),
 * conservando el resto de filtros (estado, etiqueta). La lista la filtra el
 * servidor por nombre/correo/teléfono/profesión. El input es de control local:
 * `initialValue` solo siembra el estado inicial en el montaje.
 */
export function PatientSearch({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (value.trim() === current) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
    // searchParams/pathname/router son estables por render; el efecto depende de `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function clear() {
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        strokeWidth={2}
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, correo, teléfono…"
        aria-label="Buscar pacientes"
        className="field h-9 w-full pl-9 pr-8 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Limpiar búsqueda"
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-3 hover:bg-wash hover:text-ink"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
