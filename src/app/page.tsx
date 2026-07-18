import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">terap.ia</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Un espacio tranquilo de acompañamiento entre psicólogo y paciente:
          tareas, citas, cuestionarios opt-in, diario y seguimiento — en un solo
          lugar.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Acceder
          </Link>
          <p className="text-xs text-neutral-400">
            Acceso por enlace mágico · profesional y paciente
          </p>
        </div>
      </div>
    </main>
  );
}
