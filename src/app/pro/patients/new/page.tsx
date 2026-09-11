import { ActionForm } from "@/components/ui/ActionForm";
import Link from "next/link";
import { createPatientAction } from "@/lib/actions/patients";
import { DateField } from "@/components/ui/DateField";

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

      <ActionForm action={createPatientAction} className="mt-8 flex flex-col gap-5">
        <label className="block">
          <span className="field-label">Nombre completo</span>
          {/* Sin `autoFocus`: mueve el foco antes de que el usuario haya leído
              la pantalla y desorienta con lector de pantalla (WCAG 3.2.1). */}
          <input name="full_name" required className="field py-2 text-base" />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Correo (opcional)</span>
            <input name="email" type="email" className="field py-2 text-base" />
          </label>
          <label className="block">
            <span className="field-label">Teléfono (opcional)</span>
            <input name="phone" type="tel" className="field py-2 text-base" />
          </label>
          <DateField
            label="Fecha de nacimiento (opcional)"
            name="birth_date"
            defaultValue={null}
            className="py-2 text-base"
          />
          <label className="block">
            <span className="field-label">Profesión (opcional)</span>
            <input name="profession" className="field py-2 text-base" />
          </label>
        </div>

        <label className="block">
          <span className="field-label">Dirección (opcional)</span>
          <input name="address" className="field py-2 text-base" />
        </label>
        <label className="block">
          <span className="field-label">Contacto de emergencia (opcional)</span>
          <input
            name="emergency_contact"
            placeholder="Nombre y teléfono"
            className="field py-2 text-base"
          />
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
      </ActionForm>
    </div>
  );
}
