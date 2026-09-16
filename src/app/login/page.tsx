import Link from "next/link";
import { X } from "lucide-react";
import { LoginForm } from "@/app/login/LoginForm";
import { Brandmark } from "@/components/ui/Brandmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 p-6">
      {/* Salida al inicio. Es un enlace y no un `history.back()`: a esta
          pantalla se llega también desde una redirección del proxy, y volver
          atrás devolvería a la ruta protegida que acaba de rebotar. */}
      <Link
        href="/"
        aria-label="Volver al inicio"
        title="Volver al inicio"
        className="absolute top-4 right-4 rounded-lg p-2 text-ink-3 transition-colors hover:bg-wash hover:text-ink"
      >
        <X size={18} strokeWidth={1.75} aria-hidden />
      </Link>

      <Link href="/" className="inline-flex items-center">
        <Brandmark height={120} />
      </Link>
      <LoginForm invite={invite} />

      {/* Las otras dos entradas, para quien llegue aquí sin cuenta. El alta de
          pacientes NO se ofrece: no existe, y `/acceso/paciente` lo explica. */}
      {!invite && (
        <p className="text-center text-sm text-ink-2">
          ¿Eres profesional y aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-accent hover:underline">
            Crear mi consulta
          </Link>
        </p>
      )}
    </main>
  );
}
