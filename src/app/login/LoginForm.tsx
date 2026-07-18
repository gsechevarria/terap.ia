"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, type Role } from "@/lib/auth/roles";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ invite }: { invite?: string }) {
  const isInvite = !!invite;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(
    isInvite ? ROLES.PATIENT : ROLES.PROFESSIONAL,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const next = isInvite ? `/onboarding/${invite}` : undefined;
    const redirectTo = `${window.location.origin}/auth/confirm${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        data: { role: isInvite ? ROLES.PATIENT : role },
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage(
      "Te hemos enviado un enlace de acceso. Revisa tu correo y ábrelo en este dispositivo.",
    );
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">
        {isInvite ? "Aceptar invitación" : "Acceder"}
      </h1>
      <p className="mt-1 text-sm text-ink-2">
        {isInvite
          ? "Introduce tu correo para darte de alta como paciente."
          : "Sin contraseña: te enviamos un enlace por correo."}
      </p>

      {status === "sent" ? (
        <p className="mt-6 rounded bg-accent-soft p-4 text-sm text-accent">
          {message}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
          <label className="block">
            <span className="field-label">Correo electrónico</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="field py-2 text-base"
            />
          </label>

          {!isInvite && (
            <fieldset>
              <legend className="field-label">Accedes como</legend>
              <div className="grid grid-cols-2 gap-2">
                <RoleOption
                  label="Profesional"
                  value={ROLES.PROFESSIONAL}
                  checked={role === ROLES.PROFESSIONAL}
                  onSelect={setRole}
                />
                <RoleOption
                  label="Paciente"
                  value={ROLES.PATIENT}
                  checked={role === ROLES.PATIENT}
                  onSelect={setRole}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                El rol solo se asigna en tu primer acceso.
              </p>
            </fieldset>
          )}

          {status === "error" && (
            <p className="rounded bg-danger-soft p-3 text-sm text-danger">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="btn-primary h-9"
          >
            {status === "sending" ? "Enviando…" : "Enviar enlace de acceso"}
          </button>
        </form>
      )}
    </div>
  );
}

function RoleOption({
  label,
  value,
  checked,
  onSelect,
}: {
  label: string;
  value: Role;
  checked: boolean;
  onSelect: (role: Role) => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded border px-3 py-2 text-center text-sm font-medium transition-colors duration-100 ${
        checked
          ? "border-accent bg-accent-soft text-accent"
          : "border-line text-ink-2 hover:bg-wash"
      }`}
    >
      <input
        type="radio"
        name="role"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
