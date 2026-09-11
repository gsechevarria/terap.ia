"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de envío que se deshabilita solo mientras la form action está en vuelo.
 *
 * `useFormStatus` solo funciona en un componente que sea DESCENDIENTE del
 * `<form>`, por eso es un componente aparte y no un prop del formulario. Evita
 * el doble envío, que en formularios de gasto o de pago duplica registros.
 */
export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  className = "btn-primary",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
