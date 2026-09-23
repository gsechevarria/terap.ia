"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { getUserRole, homePathForRole } from "@/lib/auth/roles";
import { PasswordField } from "@/components/ui/PasswordField";

type Method = "password" | "magic" | "reset";
type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ invite }: { invite?: string }) {
  const isInvite = !!invite;
  const [method, setMethod] = useState<Method>(isInvite ? "magic" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setMessage(authErrorMessage(error));
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
    // El rol NO se envía desde el cliente: iba a `user_metadata`, que el propio
    // usuario puede reescribir. Lo fija el servidor en `handle_new_user`.
    // `shouldCreateUser` solo se permite en el alta por invitación: sin esto,
    // cualquiera con un correo se daba de alta como profesional desde /login.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: isInvite },
    });

    if (error) {
      setStatus("error");
      setMessage(authErrorMessage(error));
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
      setMessage(authErrorMessage(error));
      return;
    }
    // Mensaje deliberadamente neutro: no revela si la cuenta existe (evita
    // enumeración de usuarios). No cambiar por un "te hemos enviado…" directo.
    setStatus("sent");
    setMessage(
      "Si existe una cuenta con ese correo, te hemos enviado un enlace para establecer tu contraseña.",
    );
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-headline-lg font-semibold text-ink">
        {isInvite
          ? "Aceptar invitación"
          : method === "reset"
            ? "Restablecer contraseña"
            : "Acceder"}
      </h1>
      <p className="mt-1.5 text-[13.5px] text-ink-2">
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
        <div
          className="segmented mt-5 flex w-full"
          role="group"
          aria-label="Forma de acceder"
        >
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
          <p
            role="status"
            className="rounded-md bg-accent-soft p-4 text-[13.5px] leading-relaxed text-accent"
          >
            {message}
          </p>
          {method === "reset" && (
            <button
              type="button"
              onClick={() => switchMethod("password")}
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
              Volver al acceso
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
              className="field"
            />
          </label>
          <PasswordField
            label="Contraseña"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
          />

          {status === "error" && (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-[13.5px] text-danger-ink">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="btn-primary btn-lg"
          >
            {status === "sending" ? "Entrando…" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => switchMethod("reset")}
            className="cursor-pointer self-start text-[12.5px] text-ink-3 underline underline-offset-2 transition-colors hover:text-ink"
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
              className="field"
            />
          </label>

          {status === "error" && (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-[13.5px] text-danger-ink">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="btn-primary btn-lg"
          >
            {status === "sending" ? "Enviando…" : "Enviar enlace"}
          </button>
          <button
            type="button"
            onClick={() => switchMethod("password")}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start text-[12.5px] text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
            Volver al acceso
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
              className="field"
            />
          </label>

          {!isInvite && (
            <p className="rounded-md bg-surface-muted p-3 text-[12.5px] leading-relaxed text-ink-2">
              El acceso por enlace es solo para cuentas ya existentes. Si eres
              paciente, entra desde el enlace de invitación que te haya enviado
              tu profesional; si eres profesional y aún no tienes cuenta,
              ponte en contacto con nosotros.
            </p>
          )}

          {status === "error" && (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-[13.5px] text-danger-ink">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="btn-primary btn-lg"
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
  // El activo lo marca `aria-pressed`, que es de lo que tira `.segmented`: el
  // estado viaja al lector de pantalla y no solo al color de fondo.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-1 py-1.5 text-[13px]"
    >
      {label}
    </button>
  );
}

