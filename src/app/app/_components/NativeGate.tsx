"use client";
import { callAction } from "@/lib/action-result";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  isNativeApp,
  onNativeAppStateChange,
  registerNativePush,
  requireBiometricUnlock,
} from "@/lib/native";
import { saveNativePushTokenAction } from "@/lib/actions/native";

/**
 * En la app nativa (Capacitor): exige desbloqueo biométrico al abrir y registra
 * el push nativo. En la web (PWA) no hace nada.
 *
 * LO QUE SE CORRIGE (ago 2026): la versión anterior renderizaba `{children}`
 * SIEMPRE y superponía un div cuando `locked`. El estado inicial era
 * `useState(false)` y el bloqueo se activaba en un efecto posterior, así que el
 * HTML con las citas, el diario y las puntuaciones se servía y se pintaba antes
 * del bloqueo. Se eludía con el inspector, deshabilitando JS, o simplemente
 * porque el conmutador de apps de iOS/Android captura la pantalla antes de que
 * el overlay aparezca.
 *
 * Ahora hay tres estados y los hijos NO se montan hasta `open`.
 *
 * LO QUE SE CORRIGE (sep 2026): con el estado inicial fijo en `checking`, la
 * PWA tampoco renderizaba nada en servidor — cada carga completa mostraba
 * "Comprobando…" hasta que bajaba JavaScript y se resolvía la importación
 * dinámica de Capacitor. En un móvil con datos eso es una espera en blanco, y
 * en la web no compraba ninguna seguridad: ahí nunca hay bloqueo biométrico.
 * Ahora el servidor decide por el identificador del WebView (`nativo`) y solo
 * espera cuando de verdad hay algo que desbloquear. La comprobación en cliente
 * se mantiene por si un contenedor antiguo no trae la marca.
 *
 * ⚠️ PENDIENTE EN LA CAPA NATIVA (no se puede resolver desde React):
 *  - Android: `FLAG_SECURE` en la Activity para que el sistema no guarde la
 *    captura de la app en el conmutador de tareas ni permita capturas.
 *  - iOS: pintar un overlay en `applicationWillResignActive`, por el mismo
 *    motivo (la instantánea se toma antes de que React reaccione).
 *  Están anotados en `docs/PUBLICACION_STORES.md`.
 */
type Estado = "checking" | "locked" | "open";

export function NativeGate({
  children,
  nativo,
}: {
  children: ReactNode;
  /** El servidor ha reconocido el contenedor nativo por su identificador. */
  nativo: boolean;
}) {
  const [estado, setEstado] = useState<Estado>(nativo ? "checking" : "open");

  const intentarDesbloqueo = useCallback(async () => {
    const ok = await requireBiometricUnlock();
    setEstado(ok ? "open" : "locked");
    if (ok) {
      registerNativePush((platform, token) => callAction(saveNativePushTokenAction, platform, token)).catch((e: unknown) => {
        console.error("[native] no se ha podido registrar el push", {
          message: e instanceof Error ? e.message : "desconocido",
        });
      });
    }
  }, []);

  useEffect(() => {
    let activo = true;

    void (async () => {
      // En web (PWA) no hay bloqueo: se abre directamente.
      if (!(await isNativeApp())) {
        if (activo) setEstado("open");
        return;
      }
      const ok = await requireBiometricUnlock();
      if (!activo) return;
      setEstado(ok ? "open" : "locked");
      if (ok) {
        registerNativePush((platform, token) => callAction(saveNativePushTokenAction, platform, token)).catch((e: unknown) => {
          console.error("[native] no se ha podido registrar el push", {
            message: e instanceof Error ? e.message : "desconocido",
          });
        });
      }
    })();

    // Al pasar a segundo plano se vuelve a bloquear: si no, quien recupere el
    // móvil desbloqueado entra directo al historial clínico.
    const quitar = onNativeAppStateChange((activa) => {
      if (!activa && activo) setEstado("locked");
    });

    return () => {
      activo = false;
      void quitar();
    };
  }, []);

  if (estado === "open") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <nav aria-label="Ayuda urgente" className="flex gap-4"><a href="tel:024">Ayuda · 024</a><a href="tel:112">Emergencias · 112</a></nav>
      {estado === "checking" ? (
        <p className="text-sm text-ink-2" role="status">
          Comprobando…
        </p>
      ) : (
        <>
          <p className="text-lg font-medium">terap.ia está bloqueada</p>
          <p className="text-sm text-ink-2">
            Verifica tu identidad para continuar.
          </p>
          <button
            type="button"
            onClick={() => void intentarDesbloqueo()}
            className="btn-primary h-9 px-5"
          >
            Desbloquear
          </button>
        </>
      )}
    </div>
  );
}
