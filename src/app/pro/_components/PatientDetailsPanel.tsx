"use client";
import { callAction } from "@/lib/action-result";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cake,
  ContactRound,
  Home,
  Mail,
  Pencil,
  Phone,
  User,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { updatePatientDetailsAction } from "@/lib/actions/patients";
import { DateField } from "@/components/ui/DateField";
import { formatDate } from "@/lib/format";

export type PatientDetails = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  profession: string | null;
  emergency_contact: string | null;
};

export function PatientDetailsPanel({
  patientId,
  details,
  age,
}: {
  patientId: string;
  details: PatientDetails;
  /** Edad ya calculada en el servidor (evita "now" en el cliente). */
  age: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await callAction(updatePatientDetailsAction, patientId, formData);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  if (editing) {
    return (
      <section className="card p-5">
        <h2 className="section-label mb-4">Editar información</h2>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" name="full_name" defaultValue={details.full_name} required wide />
            <Field label="Correo" name="email" type="email" defaultValue={details.email} />
            <Field label="Teléfono" name="phone" type="tel" defaultValue={details.phone} />
            <DateField
              label="Fecha de nacimiento"
              name="birth_date"
              defaultValue={details.birth_date}
              className="h-9"
            />
            <Field label="Profesión" name="profession" defaultValue={details.profession} />
            <Field label="Dirección" name="address" defaultValue={details.address} wide />
            <Field
              label="Contacto de emergencia"
              name="emergency_contact"
              defaultValue={details.emergency_contact}
              placeholder="Nombre y teléfono"
              wide
            />
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-5 flex items-center gap-2">
            <button type="submit" disabled={pending} className="btn-primary btn-sm">
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing(false);
              }}
              className="btn-subtle btn-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    );
  }

  const rows: {
    label: string;
    value: string | null;
    Icono: LucideIcon;
    wide?: boolean;
  }[] = [
    { label: "Nombre completo", value: details.full_name, Icono: User, wide: true },
    { label: "Correo electrónico", value: details.email, Icono: Mail },
    { label: "Teléfono", value: details.phone, Icono: Phone },
    {
      label: "Fecha de nacimiento",
      value: details.birth_date
        ? `${formatDate(details.birth_date)}${age !== null ? ` · ${age} años` : ""}`
        : null,
      Icono: Cake,
    },
    { label: "Profesión", value: details.profession, Icono: Briefcase },
    { label: "Dirección", value: details.address, Icono: Home, wide: true },
    {
      label: "Contacto de emergencia",
      value: details.emergency_contact,
      Icono: ContactRound,
      wide: true,
    },
  ];

  return (
    <section className="card p-6">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="card-title">Datos personales y de contacto</h2>
          <p className="mt-0.5 text-body-sm text-ink-2">
            Amparados por el secreto profesional. Solo usted y el propio paciente
            acceden a este expediente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="btn-ghost btn-sm shrink-0"
        >
          <Pencil size={14} strokeWidth={1.75} aria-hidden />
          Editar
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
        {rows.map(({ label, value, Icono, wide }) => (
          <div
            key={label}
            className={`flex flex-col gap-1 rounded-lg p-2 transition-colors hover:bg-surface-2 ${wide ? "md:col-span-2" : ""}`}
          >
            <dt className="text-label-sm text-ink-3">{label}</dt>
            <dd className="flex items-start gap-2">
              <Icono
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="mt-0.5 shrink-0 text-ink-3"
              />
              <span className={`text-body break-words ${value ? "font-medium text-ink" : "text-ink-3"}`}>
                {value ?? "Sin registrar"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  wide,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="field-label">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="field"
      />
    </label>
  );
}
