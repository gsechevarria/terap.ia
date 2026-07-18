"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  isNativeApp,
  registerNativePush,
  requireBiometricUnlock,
} from "@/lib/native";
import { saveNativePushTokenAction } from "@/lib/actions/native";

/**
 * En la app nativa (Capacitor): exige desbloqueo biométrico al abrir y registra
 * el push nativo. En la web (PWA) no hace nada: renderiza los hijos tal cual.
 */
export function NativeGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);

  async function unlock() {
    const ok = await requireBiometricUnlock();
    setLocked(!ok);
    if (ok) registerNativePush(saveNativePushTokenAction).catch(() => {});
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!(await isNativeApp())) return;
      const ok = await requireBiometricUnlock();
      if (!active) return;
      setLocked(!ok);
      if (ok) registerNativePush(saveNativePushTokenAction).catch(() => {});
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {children}
      {locked && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
          <p className="text-lg font-medium">terap.ia está bloqueada</p>
          <p className="text-sm text-ink-2">
            Verifica tu identidad para continuar.
          </p>
          <button
            type="button"
            onClick={unlock}
            className="btn-primary h-9 px-5"
          >
            Desbloquear
          </button>
        </div>
      )}
    </>
  );
}
