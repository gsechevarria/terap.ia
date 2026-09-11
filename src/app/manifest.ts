import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` fija la identidad de la PWA. Sin él, la identidad se deriva de
    // `start_url`: cambiarla convertiría la app instalada en OTRA aplicación
    // distinta y el usuario acabaría con dos iconos.
    id: "/app",
    name: "terap.ia",
    short_name: "terap.ia",
    description:
      "Espacio de bienestar mental entre tu profesional de psicología y tú.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f5",
    theme_color: "#4f9d8b",
    lang: "es",
    dir: "ltr",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos directos a lo que se usa a diario. Deliberadamente neutros: el
    // texto aparece en el menú del icono, a la vista de cualquiera que coja el
    // móvil, así que no nombran al profesional ni nada clínico.
    shortcuts: [
      {
        name: "Registrar cómo estoy",
        short_name: "Mi día",
        url: "/app/diary",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Mis citas",
        short_name: "Citas",
        url: "/app/appointments",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
