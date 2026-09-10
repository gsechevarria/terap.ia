"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { getUserRole, homePathForRole } from "@/lib/auth/roles";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      setError("La contraseña debe tener al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError("");
    setSaving(true);

    try {
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setSaving(false);
      setError(authErrorMessage(err));
      return;
    }
    const role = getUserRole(data.user);
    window.location.assign(role ? homePathForRole(role) : "/");
    } catch (e) { setError(authErrorMessage(e)); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="block">
        <span className="field-label">Nueva contraseña</span>
        <input
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 12 caracteres"
          className="field py-2 text-base"
        />
      </label>
      <label className="block">
        <span className="field-label">Repite la contraseña</span>
        <input
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="field py-2 text-base"
        />
      </label>

      {error && (
        <p className="rounded bg-danger-soft p-3 text-sm text-danger">{error}</p>
      )}

      <button type="submit" disabled={saving} className="btn-primary h-9">
        {saving ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
