// Service worker de terap.ia: instalable + Web Push + fallback sin conexión.
const CACHE = "terapia-shell-v1";
// Mínimo imprescindible: la página de "sin conexión" y los iconos. NADA de
// datos: aquí no se cachea ni una respuesta de la API, que serían datos de
// salud persistidos en el disco del dispositivo.
const SHELL = ["/offline.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Solo se intercepta la NAVEGACIÓN, y solo para dar una página decente cuando
 * falla la red. El resto de peticiones siguen pasando al navegador: cachear
 * respuestas de la aplicación dejaría datos clínicos en el dispositivo.
 */
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      const offline = await cache.match("/offline.html");
      return (
        offline ??
        new Response("Sin conexión", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});

// Recepción de push → mostrar notificación.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "terap.ia";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/app" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click en la notificación → abrir/enfocar la app en la URL indicada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
