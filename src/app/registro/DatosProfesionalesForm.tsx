"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserRound } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { registrarProfesionalAction } from "@/lib/actions/organizations";

/**
 * Paso 3: datos profesionales y tipo de consulta.
 *
 * El tipo decide cómo nace la organización —una consulta individual o un
 * centro— y es lo único estructural que se elige aquí. Si el alta se
 * interrumpe y se repite, la acción actualiza el mismo perfil y la misma
 * organización: no se duplican ni una ni otra.
 */
export function DatosProfesionalesForm({ nombreSugerido }: { nombreSugerido: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction({ refresh: false });
  const [tipo, setTipo] = useState<"solo" | "center">("solo");
  const [nombre, setNombre] = useState(nombreSugerido);
  const [centro, setCentro] = useState("");
  const [colegio, setColegio] = useState("");
  const [numero, setNumero] = useState("");

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(
      () =>
        callAction(registrarProfesionalAction, {
          fullName: nombre,
          practiceKind: tipo,
          orgName: tipo === "center" ? centro : nombre,
          colegio,
          numeroColegiado: numero,
        }),
      () => router.push("/registro/estado"),
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <fieldset className="card flex flex-col gap-3 p-5">
        <legend className="sr-only">Tipo de consulta</legend>
        <p className="section-title">¿Cómo trabajas?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Opcion
            activo={tipo === "solo"}
            onClick={() => setTipo("solo")}
            Icono={UserRound}
            titulo="Por mi cuenta"
            detalle="Consulta individual. Solo tú."
          />
          <Opcion
            activo={tipo === "center"}
            onClick={() => setTipo("center")}
            Icono={Building2}
            titulo="En un centro"
            detalle="Varios profesionales, un mismo equipo."
          />
        </div>
      </fieldset>

      <div className="card flex flex-col gap-4 p-5">
        <div>
          <label className="field-label" htmlFor="pro-nombre">
            Nombre y apellidos
          </label>
          <input
            id="pro-nombre"
            className="field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            required
          />
        </div>

        {tipo === "center" && (
          <div>
            <label className="field-label" htmlFor="pro-centro">
              Nombre del centro
            </label>
            <input
              id="pro-centro"
              className="field"
              value={centro}
              onChange={(e) => setCentro(e.target.value)}
              placeholder="Centro de Psicología Aurora"
              required
            />
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              Es lo que verán tus pacientes en la invitación.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="pro-colegio">
              Colegio profesional
            </label>
            <input
              id="pro-colegio"
              className="field"
              value={colegio}
              onChange={(e) => setColegio(e.target.value)}
              placeholder="COP Madrid"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="pro-numero">
              Número de colegiado
            </label>
            <input
              id="pro-numero"
              className="field"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="M-12345"
            />
          </div>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Estos datos los revisa una persona antes de habilitar tu cuenta. Hasta
          entonces no podrás abrir expedientes ni invitar pacientes.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[13.5px] text-danger-ink">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary btn-lg">
        {pending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}

function Opcion({
  activo,
  onClick,
  Icono,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  Icono: typeof UserRound;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-4 text-left transition-colors ${
        activo
          ? "border-accent bg-accent-soft"
          : "border-line-strong hover:bg-surface-subtle"
      }`}
    >
      <Icono size={20} strokeWidth={1.75} aria-hidden className={activo ? "text-accent" : "text-ink-3"} />
      <span className="font-medium">{titulo}</span>
      <span className="text-[12.5px] text-ink-2">{detalle}</span>
    </button>
  );
}
