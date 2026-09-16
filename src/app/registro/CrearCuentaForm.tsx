"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { PasswordField } from "@/components/ui/PasswordField";

/**
 * Paso 1: la cuenta.
 *
 * Usa `signUp` del proveedor que ya tiene la aplicación. El nombre viaja en
 * `user_metadata` SOLO como sugerencia para rellenar el paso 3: no concede
 * absolutamente nada, porque el rol lo decide el servidor y `user_metadata` es
 * de escritura libre para el propio usuario.
 */
export function CrearCuentaForm() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setEstado("error");
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEstado("enviando");
    setMensaje("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: nombre.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/registro")}`,
      },
    });

    if (error) {
      setEstado("error");
      setMensaje(authErrorMessage(error));
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <h2 className="font-semibold">Revisa tu correo</h2>
        <p className="text-sm leading-relaxed text-ink-2">
          Hemos enviado un enlace de confirmación a{" "}
          <strong className="text-ink">{email.trim()}</strong>. Ábrelo para
          seguir con el alta.
        </p>
        <p className="text-xs text-ink-3">
          Si esa dirección ya tenía cuenta, el enlace te llevará a iniciar
          sesión en lugar de crear una nueva.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="card flex flex-col gap-4 p-5">
      <div>
        <label className="field-label" htmlFor="reg-nombre">
          Nombre y apellidos
        </label>
        <input
          id="reg-nombre"
          className="field"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label className="field-label" htmlFor="reg-email">
          Correo profesional
        </label>
        <input
          id="reg-email"
          type="email"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <PasswordField
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        ayuda="Mínimo 8 caracteres."
        required
      />

      {estado === "error" && <p className="text-sm text-danger">{mensaje}</p>}

      <button type="submit" disabled={estado === "enviando"} className="btn-primary btn-lg">
        {estado === "enviando" ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
