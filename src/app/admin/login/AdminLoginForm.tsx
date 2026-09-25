"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { getUserRole, homePathForRole } from "@/lib/auth/roles";
import { PasswordField } from "@/components/ui/PasswordField";
import { soyAdminPlataformaAction } from "@/lib/actions/admin";

type Estado =
  | { tipo: "idle" }
  | { tipo: "enviando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "sin-permiso"; destino: string };

/**
 * Acceso a la administración de plataforma.
 *
 * Es el MISMO inicio de sesión de Supabase que el general, con la cuenta y la
 * contraseña de siempre: aquí no hay credenciales propias ni guardadas en
 * ningún sitio. Lo único que cambia es a dónde se vuelve: a `/admin`, y no al
 * panel del rol, que era lo que obligaba a escribir la dirección a mano.
 *
 * Solo contraseña, sin enlace mágico: la administración no se abre desde un
 * correo.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "idle" });

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstado({ tipo: "enviando" });

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setEstado({ tipo: "error", mensaje: authErrorMessage(error) });
      return;
    }

    // Se pregunta al servidor si la cuenta es administradora. Si lo es, la
    // página vuelve a pintarse y pide el segundo factor; si no, se dice claro
    // en vez de mandar a un 404 sin explicación.
    const r = await soyAdminPlataformaAction();
    if (r.success && r.data) {
      router.refresh();
      return;
    }
    const rol = getUserRole(data.user);
    setEstado({ tipo: "sin-permiso", destino: rol ? homePathForRole(rol) : "/login" });
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-headline-lg font-semibold text-ink">Administración</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-2">
        Acceso a la administración de la plataforma. Entra con tu correo y tu
        contraseña de siempre.
      </p>

      {estado.tipo === "sin-permiso" ? (
        <div className="mt-5 flex flex-col gap-3">
          <p role="alert" className="rounded-md bg-warning-soft p-3 text-[13.5px] text-warning-ink">
            Has iniciado sesión, pero esta cuenta no administra la plataforma.
          </p>
          <a href={estado.destino} className="btn-primary btn-lg">
            Ir a tu panel
          </a>
        </div>
      ) : (
        <form onSubmit={entrar} className="mt-5 flex flex-col gap-4">
          <label className="block">
            <span className="field-label">Correo electrónico</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {estado.tipo === "error" && (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-[13.5px] text-danger-ink">
              {estado.mensaje}
            </p>
          )}

          <button
            type="submit"
            disabled={estado.tipo === "enviando"}
            className="btn-primary btn-lg"
          >
            {estado.tipo === "enviando" ? "Entrando…" : "Entrar"}
          </button>
        </form>
      )}
    </div>
  );
}
