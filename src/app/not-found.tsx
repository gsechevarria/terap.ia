import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold">Esta página no existe</h1>
      <p className="text-sm leading-relaxed text-ink-2">
        El enlace puede haber caducado o estar mal copiado. Si has llegado desde
        una invitación, pide a tu profesional que te envíe una nueva.
      </p>
      <Link href="/" className="btn-primary">
        Ir al inicio
      </Link>
    </main>
  );
}
