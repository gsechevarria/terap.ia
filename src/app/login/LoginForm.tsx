"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, getUserRole, homePathForRole, type Role } from "@/lib/auth/roles";

type Method = "password" | "magic" | "reset";
type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ invite }: { invite?: string }) {
  const isInvite = !!invite;
  const [method, setMethod] = useState<Method>(isInvite ? "magic" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(
    isInvite ? ROLES.PATIENT : ROLES.PROFESSIONAL,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  function switchMethod(m: Method) {
    setMethod(m);
    setStatus("idle");
    setMessage("");
  }

  /** Entrada con contraseña (solo cuentas existentes; el alta llegará con el wizard). */
  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setMessage(
        error.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : error.message,
      );
      return;
    }
    const userRole = getUserRole(data.user);
    window.location.assign(userRole ? homePathForRole(userRole) : "/login?error=sin-rol");
  }

  /** Enlace mágico (crea la cuenta en el primer acceso y fija el rol). */
  async function onMagicSubmit(event: FormEvent<HTMLFormElement>) {
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

  /** Restablecer (o crear por primera vez) la contraseña. */
  async function onResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/account/password")}`,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage(
      "Si existe una cuenta con ese correo, te hemos enviado un enlace para establecer tu contraseña.",
    );
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">
        {isInvite
          ? "Aceptar invitación"
          : method === "reset"
            ? "Restablecer contraseña"
            : "Acceder"}
      </h1>
      <p className="mt-1 text-sm text-ink-2">
        {isInvite
          ? "Introduce tu correo para darte de alta como paciente."
          : method === "password"
            ? "Entra con tu correo y contraseña."
            : method === "magic"
              ? "Sin contraseña: te enviamos un enlace por correo."
              : "Te enviamos un enlace para crear una contraseña nueva."}
      </p>

      {/* Selector de método (no aplica al alta por invitación) */}
      {!isInvite && method !== "reset" && (
        <div className="mt-5 grid grid-cols-2 gap-0.5 rounded bg-panel p-0.5">
          <MethodTab
            label="Contraseña"
            active={method === "password"}
            onClick={() => switchMethod("password")}
          />
          <MethodTab
            label="Enlace mágico"
            active={method === "magic"}
            onClick={() => switchMethod("magic")}
          />
        </div>
      )}

      {status === "sent" ? (
        <div className="mt-6">
          <p className="rounded bg-accent-soft p-4 text-sm text-accent">
            {message}
          </p>
          {method === "reset" && (
            <button
              type="button"
              onClick={() => switchMethod("password")}
              className="mt-3 text-sm text-ink-3 hover:text-ink"
            >
              ← Volver al acceso
            </button>
          )}
        </div>
      ) : method === "password" && !isInvite ? (
        <form onSubmit={onPasswordSubmit} className="mt-5 flex flex-col gap-4">
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
          <label className="block">
            <span className="field-label">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field py-2 text-base"
            />
          </label>

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
            {status === "sending" ? "Entrando…" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => switchMethod("reset")}
            className="self-start text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
          >
            ¿Has olvidado tu contraseña o aún no tienes una?
          </button>
        </form>
      ) : method === "reset" ? (
        <form onSubmit={onResetSubmit} className="mt-5 flex flex-col gap-4">
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
            {status === "sending" ? "Enviando…" : "Enviar enlace"}
          </button>
          <button
            type="button"
            onClick={() => switchMethod("password")}
            className="self-start text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
          >
            ← Volver al acceso
          </button>
        </form>
      ) : (
        <form onSubmit={onMagicSubmit} className="mt-5 flex flex-col gap-5">
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

function MethodTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded py-1.5 text-sm font-medium transition-colors duration-100 ${
        active
          ? "bg-canvas text-ink shadow-[0_1px_2px_rgba(15,15,15,0.08)]"
          : "text-ink-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
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
