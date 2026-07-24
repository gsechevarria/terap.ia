"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updatePatientDetailsAction } from "@/lib/actions/patients";
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
        await updatePatientDetailsAction(patientId, formData);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  if (editing) {
    return (
      <section className="card p-4">
        <h2 className="section-label mb-3">Editar datos</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Nombre completo" name="full_name" defaultValue={details.full_name} required />
          <Field label="Correo" name="email" type="email" defaultValue={details.email} />
          <Field label="Teléfono" name="phone" type="tel" defaultValue={details.phone} />
          <Field label="Fecha de nacimiento" name="birth_date" type="date" defaultValue={details.birth_date} />
          <Field label="Profesión" name="profession" defaultValue={details.profession} />
          <Field label="Dirección" name="address" defaultValue={details.address} />
          <Field
            label="Contacto de emergencia"
            name="emergency_contact"
            defaultValue={details.emergency_contact}
            placeholder="Nombre y teléfono"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="mt-1 flex items-center gap-2">
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

  const rows: { label: string; value: string | null }[] = [
    { label: "Correo", value: details.email },
    { label: "Teléfono", value: details.phone },
    {
      label: "Nacimiento",
      value: details.birth_date
        ? `${formatDate(details.birth_date)}${age !== null ? ` · ${age} años` : ""}`
        : null,
    },
    { label: "Profesión", value: details.profession },
    { label: "Dirección", value: details.address },
    { label: "Emergencia", value: details.emergency_contact },
  ];
  const hasAny = rows.some((r) => r.value);

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label">Datos de contacto</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-3 hover:bg-wash hover:text-ink"
        >
          <Pencil className="size-3.5" strokeWidth={2} />
          Editar
        </button>
      </div>
      {hasAny ? (
        <dl className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-0.5">
              <dt className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
                {r.label}
              </dt>
              <dd className="text-sm break-words text-ink">{r.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-ink-3">
          Sin datos de contacto todavía. Añádelos con «Editar».
        </p>
      )}
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
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="field h-8 w-full px-2 py-1 text-sm"
      />
    </label>
  );
}
