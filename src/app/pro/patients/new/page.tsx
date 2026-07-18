import Link from "next/link";
import { createPatientAction } from "@/lib/actions/patients";

export default function NewPatientPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/pro" className="text-sm text-ink-3 hover:text-ink">
        ← Pacientes
      </Link>
      <h1 className="page-title mt-3">Nuevo paciente</h1>
      <p className="mt-1 text-sm text-ink-2">
        Crea la ficha. Después podrás generar un enlace de invitación para que
        se dé de alta.
      </p>

      <form action={createPatientAction} className="mt-8 flex flex-col gap-5">
        <label className="block">
          <span className="field-label">Nombre completo</span>
          <input name="full_name" required autoFocus className="field py-2 text-base" />
        </label>
        <label className="block">
          <span className="field-label">Correo (opcional)</span>
          <input name="email" type="email" className="field py-2 text-base" />
        </label>
        <label className="block">
          <span className="field-label">Etiquetas (separadas por comas)</span>
          <input
            name="tags"
            placeholder="ansiedad, quincenal"
            className="field py-2 text-base"
          />
        </label>
        <button type="submit" className="btn-primary h-9 self-start px-5">
          Crear paciente
        </button>
      </form>
    </div>
  );
}
