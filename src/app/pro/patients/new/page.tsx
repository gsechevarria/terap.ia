import Link from "next/link";
import { createPatientAction } from "@/lib/actions/patients";

export default function NewPatientPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/pro" className="text-sm text-neutral-500 hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Nuevo paciente
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Crea la ficha. Después podrás generar un enlace de invitación para que se
        dé de alta.
      </p>

      <form action={createPatientAction} className="mt-6 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nombre completo
          <input
            name="full_name"
            required
            autoFocus
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/[.16] dark:focus:border-white/50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Correo (opcional)
          <input
            name="email"
            type="email"
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/[.16] dark:focus:border-white/50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Etiquetas (separadas por comas)
          <input
            name="tags"
            placeholder="ansiedad, quincenal"
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/[.16] dark:focus:border-white/50"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Crear paciente
        </button>
      </form>
    </div>
  );
}
