import { ActionForm } from "@/components/ui/ActionForm";
import { createPatientAction } from "@/lib/actions/patients";
import { DateField } from "@/components/ui/DateField";
import { Migas } from "@/app/pro/_components/Migas";

export default function NewPatientPage() {
  return (
    // Cabecera como el resto del panel, alineada a la izquierda; el formulario
    // conserva su ancho de lectura en vez de centrarse en la hoja.
    <div>
      <Migas tramos={[{ href: "/pro/patients", texto: "Pacientes" }, { texto: "Nuevo paciente" }]} />
      <h1 className="page-title mt-3">Nuevo paciente</h1>
      <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">
        Crea la ficha. Después podrás generar un enlace de invitación para que
        se dé de alta.
      </p>

      <ActionForm action={createPatientAction} className="mt-8 flex max-w-xl flex-col gap-5">
        <label className="block">
          <span className="field-label">Nombre completo</span>
          {/* Sin `autoFocus`: mueve el foco antes de que el usuario haya leído
              la pantalla y desorienta con lector de pantalla (WCAG 3.2.1). */}
          <input name="full_name" required className="field" />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Correo (opcional)</span>
            <input name="email" type="email" className="field" />
          </label>
          <label className="block">
            <span className="field-label">Teléfono (opcional)</span>
            <input name="phone" type="tel" className="field" />
          </label>
          {/* Sin `className`: `.field` ya trae el tamaño y el relleno del
              disparador, y repetirlos aquí solo invita a que se descuadre. */}
          <DateField
            label="Fecha de nacimiento (opcional)"
            name="birth_date"
            defaultValue={null}
          />
          <label className="block">
            <span className="field-label">Profesión (opcional)</span>
            <input name="profession" className="field" />
          </label>
        </div>

        <label className="block">
          <span className="field-label">Dirección (opcional)</span>
          <input name="address" className="field" />
        </label>
        <label className="block">
          <span className="field-label">Contacto de emergencia (opcional)</span>
          <input
            name="emergency_contact"
            placeholder="Nombre y teléfono"
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">Etiquetas (separadas por comas)</span>
          <input
            name="tags"
            placeholder="ansiedad, quincenal"
            className="field"
          />
        </label>
        {/* La acción se separa del formulario con una línea, no con otra caja. */}
        <div className="border-t border-line pt-5">
          <button type="submit" className="btn-primary px-5">
            Crear paciente
          </button>
        </div>
      </ActionForm>
    </div>
  );
}
