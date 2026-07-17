"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA una vez montada la app del paciente. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
