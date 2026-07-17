import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "terap.ia",
  description:
    "Espacio de bienestar mental entre profesional y paciente de consulta privada.",
  appleWebApp: { capable: true, title: "terap.ia", statusBarStyle: "default" },
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
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Banner permanente: mientras no exista DPA + base jurídica RGPD art. 9,
            solo se usan datos ficticios. */}
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Entorno de demostración — datos ficticios
        </div>
        {children}
      </body>
    </html>
  );
}
