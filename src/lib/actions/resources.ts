"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  requireOwnedPatient,
  requireProfessional,
} from "@/lib/queries/identity";
import { safeExternalUrl } from "@/lib/url";

function storagePath(patientId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${patientId}/${crypto.randomUUID()}-${safe}`;
}

/** El profesional comparte un enlace (por paciente o, si patientId vacío, a todos). */
export async function addResourceLinkAction(input: {
  patientId: string | null;
  title: string;
  url: string;
}) {
  // Sin patientId el recurso es para todos los pacientes del profesional; con
  // él hay que comprobar propiedad.
  const pro = input.patientId
    ? (await requireOwnedPatient(input.patientId)).pro
    : await requireProfessional();
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  // Mismo motivo que en video_link: el enlace se pinta como href al paciente.
  const url = safeExternalUrl(input.url);
  if (!url) {
    throw new Error("El enlace no es válido. Debe empezar por https:// o http://.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    professional_id: pro.id,
    patient_id: input.patientId || null,
    title: input.title.trim(),
    kind: "link",
    url,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${input.patientId ?? ""}`);
}

/** El profesional sube un archivo (PDF/audio) como recurso para un paciente. */
export async function addResourceFileAction(formData: FormData) {
  const patientId = String(formData.get("patientId") ?? "");
  const { pro } = await requireOwnedPatient(patientId);
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "pdf");
  const file = formData.get("file") as File | null;
  if (!title || !file || file.size === 0) {
    throw new Error("Faltan datos del recurso.");
  }

  const supabase = await createClient();
  const path = storagePath(patientId, file.name);
  const up = await supabase.storage
    .from("files")
    .upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);

  const { error } = await supabase.from("resources").insert({
    professional_id: pro.id,
    patient_id: patientId,
    title,
    kind: kind === "audio" ? "audio" : "pdf",
    storage_path: path,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function deleteResourceAction(id: string, patientId: string) {
  const pro = patientId
    ? (await requireOwnedPatient(patientId)).pro
    : await requireProfessional();
  const supabase = await createClient();
  const { data: res } = await supabase
    .from("resources")
    .select("storage_path")
    .eq("id", id)
    .eq("professional_id", pro.id)
    .maybeSingle();
  if (!res) throw new Error("Recurso no encontrado.");
  if (res.storage_path) {
    await supabase.storage.from("files").remove([res.storage_path]);
  }
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}
