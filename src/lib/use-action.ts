"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionErrorMessage } from "@/lib/errors";

/**
 * Envuelve la llamada a una server action desde el cliente.
 *
 * Sin `try/catch`, una action que lanza (y varias lo hacen: `notes.ts`,
 * `patients.ts`, `appointments.ts`…) sube hasta el error boundary y tumba la
 * pantalla entera, perdiendo lo que el usuario tuviera escrito. Generaliza el
 * patrón `run()` que ya existía suelto en `DocumentsPanel`.
 *
 * Por defecto refresca la ruta al terminar bien, que es lo que hacían todos los
 * llamantes; se puede desactivar con `{ refresh: false }`.
 */
export function useAction(options?: { refresh?: boolean }) {
  const refresh = options?.refresh ?? true;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = useCallback(
    (fn: () => Promise<void>, onSuccess?: () => void) => {
      setError("");
      startTransition(async () => {
        try {
          await fn();
          onSuccess?.();
          if (refresh) router.refresh();
        } catch (e) {
          setError(actionErrorMessage(e));
        }
      });
    },
    [refresh, router],
  );

  const clearError = useCallback(() => setError(""), []);

  return { run, pending, error, setError, clearError };
}
