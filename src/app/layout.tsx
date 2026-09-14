import type { Metadata, Viewport } from "next";
import { FranjaReglamentaria } from "@/components/FranjaReglamentaria";
import "./globals.css";

// Nonce por petición: el HTML no puede prerenderizarse ni reutilizarse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "terap.ia",
  description:
    "Espacio de bienestar mental entre profesional y paciente de consulta privada.",
  appleWebApp: { capable: true, title: "terap.ia", statusBarStyle: "default" },
  // `apple` DEBE ser PNG: Safari no admite SVG en `apple-touch-icon`, y al
  // añadir a pantalla de inicio en iOS ponía una captura de la página en vez
  // del logo.
  icons: { icon: "/logo-mark.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#4f9d8b",
  width: "device-width",
  initialScale: 1,
  // Sin `maximumScale` ni `userScalable: false`: bloquear el pinch-zoom
  // incumple WCAG 2.2 §1.4.4 (AA) en una app que muestra escalas clínicas,
  // importes y horas a 10-11 px. El auto-zoom de iOS al enfocar un input se
  // evita con los 16px de `.field`, no capando el zoom del usuario.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* Franja reglamentaria fija. Se controla con `NEXT_PUBLIC_DEMO_MODE` y
            NO borrando código: cuando llegue el primer paciente real bastará
            con poner la variable a "false" en Vercel, sin tocar el repositorio
            ni desplegar a ciegas. Por defecto está encendido, que es el lado
            seguro del error. Lo que la franja afirma vive en
            `src/lib/entorno-clinico.ts`. */}
        <FranjaReglamentaria />
        {children}
      </body>
    </html>
  );
}
