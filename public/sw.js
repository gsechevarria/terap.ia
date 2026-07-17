// Service worker mínimo de terap.ia.
// Presencia de un handler de fetch => la PWA es instalable. El cacheo/offline
// completo llega en sesiones posteriores (apps nativas / pulido).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Passthrough: el navegador gestiona la petición con normalidad.
});
