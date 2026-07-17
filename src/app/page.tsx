import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-4xl font-semibold tracking-tight">terap.ia</h1>
        <p className="mt-3 text-lg text-neutral-500">
          Un espacio tranquilo de acompañamiento entre tu psicólogo y tú.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Acceder
          </Link>
        </div>
      </div>
    </main>
  );
}
