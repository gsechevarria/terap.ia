"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";

function storagePath(patientId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${patientId}/${crypto.randomUUID()}-${safe}`;
}

/** El profesional sube un documento al repositorio del paciente (Storage). */
export async function addDocumentAction(formData: FormData) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();

  const patientId = String(formData.get("patientId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!patientId || !file || file.size === 0) {
    throw new Error("Falta el archivo.");
  }

  const supabase = await createClient();
  const path = storagePath(patientId, file.name);
  const up = await supabase.storage
    .from("files")
    .upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);

  const { error } = await supabase.from("documents").insert({
    professional_id: pro.id,
    patient_id: patientId,
    title: title || file.name,
    storage_path: path,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function deleteDocumentAction(id: string, patientId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (doc?.storage_path) {
    await supabase.storage.from("files").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}
