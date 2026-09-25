"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { SignOutForm } from "@/components/SignOutForm";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "alta"; factorId: string; qr: string; secreto: string }
  | { tipo: "verificar"; factorId: string }
  | { tipo: "error-carga"; mensaje: string };

/**
 * Segundo factor de la administración (TOTP de Supabase Auth).
 *
 * La primera vez se da de alta: se enseña el QR para la app de autenticación
 * (Google Authenticator, 1Password, Authy…) y se confirma con un código. Las
 * siguientes, solo se pide el código.
 *
 * Que la sesión pase a `aal2` no es cosmética: `is_platform_admin()` lo exige
 * en la base, así que sin este paso no hay ni lectura ni RPC de administración.
 *
 * Si se pierde el dispositivo, el factor se retira fuera de banda (ver
 * docs/ADMIN-DOBLE-FACTOR.md); desde aquí no se puede, a propósito.
 */
export function SegundoFactor() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  // En desarrollo React monta dos veces: sin esto se darían de alta dos
  // factores a la vez.
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const supabase = createClient();
    (async () => {
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (e) {
        setEstado({ tipo: "error-carga", mensaje: authErrorMessage(e) });
        return;
      }
      const verificado = data.totp[0];
      if (verificado) {
        setEstado({ tipo: "verificar", factorId: verificado.id });
        return;
      }
      // Un alta que se quedó sin confirmar impide empezar otra: se retira.
      for (const f of data.all) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const alta = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "terap.ia administración",
        issuer: "terap.ia",
      });
      if (alta.error) {
        setEstado({ tipo: "error-carga", mensaje: authErrorMessage(alta.error) });
        return;
      }
      setEstado({
        tipo: "alta",
        factorId: alta.data.id,
        qr: alta.data.totp.qr_code,
        secreto: alta.data.totp.secret,
      });
    })().catch((e: unknown) =>
      setEstado({ tipo: "error-carga", mensaje: e instanceof Error ? e.message : String(e) }),
    );
  }, []);

  async function verificar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (estado.tipo !== "alta" && estado.tipo !== "verificar") return;
    setEnviando(true);
    setError("");
    const { error: e } = await createClient().auth.mfa.challengeAndVerify({
      factorId: estado.factorId,
      code: codigo.trim(),
    });
    setEnviando(false);
    if (e) {
      setError("El código no es válido o ha caducado. Prueba con el siguiente.");
      setCodigo("");
      return;
    }
    // La sesión ya es `aal2`. `replace`: volver atrás no debe traer el código.
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-headline-lg font-semibold text-ink">Segundo factor</h1>

      {estado.tipo === "cargando" && (
        <p className="mt-3 text-[13.5px] text-ink-3" aria-live="polite">
          Preparando la verificación…
        </p>
      )}

      {estado.tipo === "error-carga" && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-[13.5px] text-danger-ink">
          No se ha podido preparar el segundo factor: {estado.mensaje}
        </p>
      )}

      {estado.tipo === "alta" && (
        <div className="mt-1.5 flex flex-col gap-3 text-[13.5px] text-ink-2">
          <p>
            La administración exige un segundo factor. Escanea este código con tu
            app de autenticación y escribe el código de seis cifras que te dé.
          </p>
          <div className="self-center rounded-xl bg-white p-3">
            {/* SVG `data:` que genera Supabase: `next/image` no optimiza nada
                aquí, y la CSP ya admite `data:` en `img-src`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={estado.qr} alt="Código QR para la app de autenticación" width={180} height={180} />
          </div>
          <p className="text-[12.5px] text-ink-3">
            ¿No puedes escanearlo? Introduce esta clave a mano:{" "}
            <code className="break-all font-medium text-ink">{estado.secreto}</code>
          </p>
        </div>
      )}

      {estado.tipo === "verificar" && (
        <p className="mt-1.5 text-[13.5px] text-ink-2">
          Escribe el código de seis cifras de tu app de autenticación.
        </p>
      )}

      {(estado.tipo === "alta" || estado.tipo === "verificar") && (
        <form onSubmit={verificar} className="mt-5 flex flex-col gap-4">
          <label className="block">
            <span className="field-label">Código</span>
            <input
              className="field tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-[13.5px] text-danger-ink">
              {error}
            </p>
          )}
          <button type="submit" disabled={enviando || codigo.length !== 6} className="btn-primary btn-lg">
            {enviando ? "Comprobando…" : "Verificar"}
          </button>
        </form>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[12.5px] text-ink-3">
        <span>¿Otra cuenta?</span>
        <SignOutForm />
      </div>
    </div>
  );
}
