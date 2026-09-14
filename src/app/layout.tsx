import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { FranjaReglamentaria } from "@/components/FranjaReglamentaria";
import "./globals.css";

/**
 * `next/font` auto-hospeda las fuentes en el build: no hay ninguna petición a
 * Google en tiempo de ejecución. Eso importa por dos motivos y no solo por
 * velocidad — la CSP puede seguir con `font-src 'self'` y `style-src` sin
 * abrir a terceros, y la IP del paciente no viaja a un tercero por el hecho de
 * abrir su expediente.
 *
 * Inter para la interfaz; JetBrains Mono para cifras e identificadores, donde
 * el ancho fijo evita que las columnas bailen entre filas.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El proxy genera un nonce por petición y lo pasa en la cabecera; el script
  // de aspecto lo necesita para no chocar con `script-src 'self' 'nonce-…'`.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="es"
      className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      {/* Aplica el aspecto elegido ANTES del primer pintado: sin esto, quien
          fuerza el modo oscuro ve un fogonazo claro en cada navegación dura.
          Lleva el nonce de la CSP, que es por petición. */}
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{var a=localStorage.getItem('terapia:aspecto');if(a==='light'||a==='dark')document.documentElement.classList.add(a)}catch(e){}",
          }}
        />
      </head>
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
