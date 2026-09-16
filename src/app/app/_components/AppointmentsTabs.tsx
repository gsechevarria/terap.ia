"use client";

import { useState, type ReactNode } from "react";

/**
 * Segmentado Próximas / Anteriores.
 *
 * El conmutador vive en cliente y no en el parámetro de la URL —que es el
 * patrón del panel del profesional— porque las dos listas salen de la MISMA
 * consulta (`getMyAppointmentsSplit`) y ya viajan en el HTML. Pasarlo por el
 * servidor añadiría una ida y vuelta por datos móviles para enseñar algo que
 * el teléfono ya tiene.
 *
 * Los paneles llegan renderizados desde el servidor: aquí solo se decide cuál
 * se muestra.
 */
export function AppointmentsTabs({
  proximasCount,
  proximas,
  anteriores,
}: {
  proximasCount: number;
  proximas: ReactNode;
  anteriores: ReactNode;
}) {
  const [vista, setVista] = useState<"proximas" | "anteriores">("proximas");

  return (
    <>
      <div className="tp-segment" role="group" aria-label="Vista de citas">
        <button
          type="button"
          aria-pressed={vista === "proximas"}
          onClick={() => setVista("proximas")}
        >
          Próximas
          {proximasCount > 0 && <span>{proximasCount}</span>}
        </button>
        <button
          type="button"
          aria-pressed={vista === "anteriores"}
          onClick={() => setVista("anteriores")}
        >
          Anteriores
        </button>
      </div>

      <div hidden={vista !== "proximas"}>{proximas}</div>
      <div hidden={vista !== "anteriores"}>{anteriores}</div>
    </>
  );
}
