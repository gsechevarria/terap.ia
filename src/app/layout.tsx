import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "terap.ia",
  description:
    "Espacio de bienestar mental entre profesional y paciente de consulta privada.",
  appleWebApp: { capable: true, title: "terap.ia", statusBarStyle: "default" },
  icons: { icon: "/logo-mark.svg", apple: "/logo-mark.svg" },
};

export const viewport: Viewport = {
  themeColor: "#4f9d8b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* Banner permanente: mientras no exista DPA + base jurídica RGPD art. 9,
            solo se usan datos ficticios. */}
        <div className="flex h-[var(--banner-h)] items-center justify-center gap-1.5 border-b border-line bg-warn-soft px-4 text-center text-xs font-medium text-warn">
          <span aria-hidden className="text-[8px]">
            ●
          </span>
          Entorno de demostración — datos ficticios
        </div>
        {children}
      </body>
    </html>
  );
}
