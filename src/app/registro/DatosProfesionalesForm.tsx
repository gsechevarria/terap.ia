"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserRound } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { registrarProfesionalAction } from "@/lib/actions/organizations";
import { createClient } from "@/lib/supabase/client";
import { COLEGIOS, colegioPorClaveONombre } from "@/lib/colegios";

/** Otro colegio: se escribe a mano y lo revisa una persona. */
const OTRO = "otro";

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
  const [otroColegio, setOtroColegio] = useState("");
  const [numero, setNumero] = useState("");
  const elegido = colegio === OTRO ? null : colegioPorClaveONombre(colegio);
  const seComprueba = Boolean(elegido?.integracion);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let aprobada = false;
    run(
      async () => {
        const r = await callAction(registrarProfesionalAction, {
          fullName: nombre,
          practiceKind: tipo,
          orgName: tipo === "center" ? centro : nombre,
          colegio: colegio === OTRO ? otroColegio : colegio,
          numeroColegiado: numero,
        });
        aprobada = r.resultado === "approved";
        // El rol lo acaba de cambiar el servidor, pero la sesión del navegador
        // lleva el de antes dentro del token. Sin renovarla, la base de datos
        // seguiría viendo una cuenta pendiente hasta que caducara (hasta 1 h).
        if (aprobada) await createClient().auth.refreshSession();
      },
      () => router.push(aprobada ? "/pro" : "/registro/estado"),
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
            <select
              id="pro-colegio"
              className="field"
              value={colegio}
              onChange={(e) => setColegio(e.target.value)}
              required
            >
              <option value="" disabled>
                Elige tu colegio
              </option>
              {COLEGIOS.map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.nombre}
                </option>
              ))}
              <option value={OTRO}>Otro colegio</option>
            </select>
            {colegio === OTRO && (
              <input
                aria-label="Nombre del colegio"
                className="field mt-2"
                value={otroColegio}
                onChange={(e) => setOtroColegio(e.target.value)}
                placeholder="Nombre del colegio"
                required
              />
            )}
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
              placeholder={elegido?.clave === "cop-madrid" ? "M-12345" : "Tu número"}
              required
            />
          </div>
        </div>
        {/* Se dice ANTES de enviar qué va a pasar con estos datos. */}
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          {seComprueba ? (
            <>
              Los comprobamos al momento en el registro público de tu colegio:
              si el número, tu nombre y la situación de ejerciente coinciden, tu
              cuenta queda habilitada en el acto. Escribe tu nombre y apellidos
              tal como figuran en tu colegio. Si algo no coincide, lo revisa una
              persona.
            </>
          ) : (
            <>
              Estos datos los revisa una persona antes de habilitar tu cuenta.
              Hasta entonces no podrás abrir expedientes ni invitar pacientes.
            </>
          )}
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
