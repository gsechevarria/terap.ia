"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional, requireOwnedPatient } from "@/lib/queries/identity";
import type { PatientStatus } from "@/lib/types";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Lee un campo de texto opcional del FormData; devuelve null si viene vacío. */
function optionalText(formData: FormData, key: string): string | null {
  return String(formData.get(key) ?? "").trim() || null;
}

/** Campos de contacto/personales editables de la ficha. */
const CONTACT_KEYS = [
  "phone",
  "birth_date",
  "address",
  "profession",
  "emergency_contact",
] as const;

/** Crea un paciente y redirige a su ficha. Se invoca desde un <form>. */
async function createPatientActionImpl(formData: FormData) {
  const pro = await getCurrentProfessional();
  if (!pro) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  if (!fullName) throw new ActionInputError("El nombre es obligatorio.");

  const contact = Object.fromEntries(
    CONTACT_KEYS.map((k) => [k, optionalText(formData, k)]),
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      professional_id: pro.id,
      full_name: fullName,
      email: optionalText(formData, "email"),
      tags,
      status: "active",
      ...contact,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/pro");
  redirect(`/pro/patients/${data.id}`);
}

/**
 * Actualiza los datos de contacto/personales del paciente desde la ficha.
 * RLS garantiza que solo el profesional dueño puede modificarlo.
 */
async function updatePatientDetailsActionImpl(
  patientId: string,
  formData: FormData,
) {
  const { pro } = await requireOwnedPatient(patientId);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) throw new ActionInputError("El nombre es obligatorio.");

  const contact = Object.fromEntries(
    CONTACT_KEYS.map((k) => [k, optionalText(formData, k)]),
  );

  const supabase = await createClient();
  // `.select().maybeSingle()`: en PostgREST un UPDATE/DELETE que no casa
  // ninguna fila devuelve `error: null`, así que la UI cerraba el editor,
  // refrescaba y mostraba los datos antiguos como si se hubieran guardado.
  const { data, error } = await supabase
    .from("patients")
    .update({
      full_name: fullName,
      email: optionalText(formData, "email"),
      ...contact,
    })
    .eq("id", patientId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Paciente no encontrado.");

  revalidatePath("/pro");
  revalidatePath(`/pro/patients/${patientId}`);
}

/** Archiva o reactiva un paciente (sin borrar histórico). */
async function setPatientStatusActionImpl(
  patientId: string,
  status: PatientStatus,
) {
  const { pro } = await requireOwnedPatient(patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .update({ status })
    .eq("id", patientId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Paciente no encontrado.");
  revalidatePath("/pro");
  revalidatePath(`/pro/patients/${patientId}`);
}

/** Actualiza las etiquetas del paciente. */
async function updatePatientTagsActionImpl(patientId: string, tags: string[]) {
  const { pro } = await requireOwnedPatient(patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .update({ tags })
    .eq("id", patientId)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Paciente no encontrado.");
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function createPatientAction(...args: Parameters<typeof createPatientActionImpl>) { return runAction(() => createPatientActionImpl(...args)); }

export async function updatePatientDetailsAction(...args: Parameters<typeof updatePatientDetailsActionImpl>) { return runAction(() => updatePatientDetailsActionImpl(...args)); }

export async function setPatientStatusAction(...args: Parameters<typeof setPatientStatusActionImpl>) { return runAction(() => setPatientStatusActionImpl(...args)); }

export async function updatePatientTagsAction(...args: Parameters<typeof updatePatientTagsActionImpl>) { return runAction(() => updatePatientTagsActionImpl(...args)); }
