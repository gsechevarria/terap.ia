"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA una vez montada la app del paciente. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e: unknown) => {
        // Silencioso de cara al usuario (la app funciona sin service worker),
        // pero con rastro: el `.catch(() => {})` mudo escondía que la PWA no se
        // podía instalar ni recibir push, y nadie se enteraba.
        console.error("[pwa] no se ha podido registrar el service worker", {
          message: e instanceof Error ? e.message : "desconocido",
        });
      });
    }
  }, []);
  return null;
}
