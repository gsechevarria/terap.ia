"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import type { PatientStatus } from "@/lib/types";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Crea un paciente y redirige a su ficha. Se invoca desde un <form>. */
export async function createPatientAction(formData: FormData) {
  const pro = await getCurrentProfessional();
  if (!pro) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));
  if (!fullName) throw new Error("El nombre es obligatorio.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({ professional_id: pro.id, full_name: fullName, email, tags, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/pro");
  redirect(`/pro/patients/${data.id}`);
}

/** Archiva o reactiva un paciente (sin borrar histórico). */
export async function setPatientStatusAction(
  patientId: string,
  status: PatientStatus,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ status })
    .eq("id", patientId);
  if (error) throw new Error(error.message);
  revalidatePath("/pro");
  revalidatePath(`/pro/patients/${patientId}`);
}

/** Actualiza las etiquetas del paciente. */
export async function updatePatientTagsAction(patientId: string, tags: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ tags })
    .eq("id", patientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}
