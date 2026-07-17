"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, type Role } from "@/lib/auth/roles";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(ROLES.PROFESSIONAL);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        // `data` solo se aplica al CREAR el usuario (primer acceso). Fija el rol.
        data: { role },
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
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.12] dark:bg-neutral-900">
        <h1 className="text-2xl font-semibold tracking-tight">Acceder a terap.ia</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Acceso sin contraseña mediante enlace mágico.
        </p>

        {status === "sent" ? (
          <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {message}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Correo electrónico
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/[.16] dark:focus:border-white/50"
              />
            </label>

            <fieldset className="flex flex-col gap-1.5 text-sm font-medium">
              <legend className="mb-1.5">Accedes como</legend>
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
              <p className="mt-1 text-xs font-normal text-neutral-500">
                El rol solo se asigna en tu primer acceso.
              </p>
            </fieldset>

            {status === "error" && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {status === "sending" ? "Enviando…" : "Enviar enlace de acceso"}
            </button>
          </form>
        )}
      </div>
    </main>
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
      className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
        checked
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
          : "border-black/[.12] hover:bg-black/[.03] dark:border-white/[.16] dark:hover:bg-white/[.06]"
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
