"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Campo de contraseña con botón para revelarla.
 *
 * Arranca SIEMPRE oculto y no recuerda la elección entre campos ni entre
 * visitas: esta aplicación se usa en consultas donde el portátil está a la
 * vista del paciente, y una contraseña que se quedara revelada por defecto
 * sería una fuga silenciosa.
 *
 * El botón va dentro del campo pero fuera de la etiqueta, con su propio nombre
 * accesible, que cambia con el estado: quien usa lector de pantalla necesita
 * saber si al pulsar va a mostrar u ocultar, no solo que hay un botón.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = false,
  placeholder = "••••••••",
  minLength,
  ayuda,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  /** Texto de apoyo bajo el campo (p. ej. requisitos de longitud). */
  ayuda?: string;
}) {
  const [visible, setVisible] = useState(false);
  const idCampo = useId();
  const idAyuda = useId();

  return (
    <div className="block">
      <label htmlFor={idCampo} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={idCampo}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={ayuda ? idAyuda : undefined}
          // Hueco a la derecha para que el texto no pase por debajo del botón.
          className="field pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((previo) => !previo)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          // `-translate-y-1/2` sobre `top-1/2` lo centra sea cual sea el alto
          // del campo, que cambia con el tamaño de fuente del navegador.
          className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-wash hover:text-ink"
        >
          {visible ? (
            <EyeOff size={16} strokeWidth={1.75} aria-hidden />
          ) : (
            <Eye size={16} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      {ayuda && (
        <p id={idAyuda} className="mt-1.5 text-[11px] text-ink-3">
          {ayuda}
        </p>
      )}
    </div>
  );
}
