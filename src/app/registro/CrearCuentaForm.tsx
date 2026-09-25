"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { PasswordField } from "@/components/ui/PasswordField";
import { reiniciarAltaIncompletaAction } from "@/lib/actions/registro";

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
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "existe" | "error">("idle");
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
    const alta = () =>
      supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // `alta: "profesional"` solo ENRUTA: si la cuenta se queda a medias,
          // al iniciar sesión se la lleva a terminar el alta en vez de a la
          // app del paciente. No concede nada: `user_metadata` es de escritura
          // libre y el rol lo decide el servidor.
          data: { full_name: nombre.trim(), alta: "profesional" },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/registro")}`,
        },
      });

    let { data, error } = await alta();
    if (error) {
      setEstado("error");
      setMensaje(authErrorMessage(error));
      return;
    }

    // Correo con cuenta ya confirmada: Supabase no envía nada y devuelve un
    // usuario sin identidades. Si esa cuenta es un alta a medias, se borra y
    // se empieza de cero; si tiene cualquier dato, se manda a iniciar sesión.
    if (data.user && data.user.identities?.length === 0) {
      const r = await reiniciarAltaIncompletaAction(email.trim());
      if (!r.success) {
        setEstado("error");
        setMensaje(r.error);
        return;
      }
      if (!r.data) {
        setEstado("existe");
        return;
      }
      ({ data, error } = await alta());
      if (error) {
        setEstado("error");
        setMensaje(authErrorMessage(error));
        return;
      }
    }
    setEstado("enviado");
  }

  if (estado === "existe") {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <h2 className="section-title">Ya tienes cuenta con ese correo</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Inicia sesión con ella. Si no recuerdas la contraseña, desde el acceso
          puedes pedir un enlace para crear una nueva.
        </p>
        <a href="/login" className="btn-primary self-start">
          Iniciar sesión
        </a>
      </div>
    );
  }

  if (estado === "enviado") {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <h2 className="section-title">Revisa tu correo</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Hemos enviado un enlace de confirmación a{" "}
          <strong className="text-ink">{email.trim()}</strong>. Ábrelo para
          seguir con el alta.
        </p>
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Si ya habías empezado el alta con esta dirección y no la terminaste,
          se ha empezado de nuevo: usa el enlace de este último correo.
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

      {estado === "error" && (
        <p role="alert" className="text-[13.5px] text-danger-ink">
          {mensaje}
        </p>
      )}

      <button type="submit" disabled={estado === "enviando"} className="btn-primary btn-lg">
        {estado === "enviando" ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
