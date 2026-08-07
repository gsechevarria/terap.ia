import type { Metadata, Viewport } from "next";
import "./globals.css";

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

/** Encendido salvo que se apague explícitamente. */
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* Banner de demostración: mientras no exista DPA + base jurídica RGPD
            art. 9, solo se usan datos ficticios.

            Se controla con `NEXT_PUBLIC_DEMO_MODE` y NO borrando código: cuando
            llegue el primer paciente real bastará con poner la variable a
            "false" en Vercel, sin tocar el repositorio ni desplegar a ciegas.
            Por defecto está ENCENDIDO: si alguien despliega sin configurarla,
            el aviso sigue puesto, que es el lado seguro del error. */}
        {demoMode && (
          <div className="flex h-[var(--banner-h)] items-center justify-center gap-1.5 border-b border-line bg-warn-soft px-4 text-center text-xs font-medium text-warn">
            <span aria-hidden className="text-[8px]">
              ●
            </span>
            Entorno de demostración — datos ficticios
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
