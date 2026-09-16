"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { aceptarInvitacionProfesionalAction } from "@/lib/actions/organizations";

/**
 * Aceptación explícita. El token se canjea AQUÍ, al pulsar, y no al abrir la
 * página: es lo que evita que un analizador de correo gaste la invitación.
 *
 * La operación es atómica en la base (`for update` sobre la invitación), así
 * que dos pestañas pulsando a la vez no crean dos membresías ni reutilizan el
 * token; la segunda recibe "invitación ya utilizada".
 */
export function AceptarEquipoForm({
  token,
  centro,
}: {
  token: string;
  centro: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useAction({ refresh: false });
  const [hecho, setHecho] = useState(false);

  function aceptar() {
    run(
      async () => {
        await callAction(aceptarInvitacionProfesionalAction, token);
      },
      () => {
        setHecho(true);
        router.push("/pro/equipo");
      },
    );
  }

  if (hecho) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-ink">
        <Check className="size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
        Ya formas parte de {centro}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={aceptar} disabled={pending} className="btn-primary btn-lg">
        {pending ? "Aceptando…" : `Unirme a ${centro}`}
      </button>
    </div>
  );
}
