"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { requireUploadedFile } from "@/lib/upload-server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  requireOwnedPatient,
  requireProfessional,
} from "@/lib/queries/identity";
import { safeExternalUrl } from "@/lib/url";

/** El profesional comparte un enlace (por paciente o, si patientId vacío, a todos). */
async function addResourceLinkActionImpl(input: {
  patientId: string | null;
  title: string;
  url: string;
}) {
  // Sin patientId el recurso es para todos los pacientes del profesional; con
  // él hay que comprobar propiedad.
  const pro = input.patientId
    ? (await requireOwnedPatient(input.patientId)).pro
    : await requireProfessional();
  if (!input.title.trim()) throw new ActionInputError("El título es obligatorio.");
  // Mismo motivo que en video_link: el enlace se pinta como href al paciente.
  const url = safeExternalUrl(input.url);
  if (!url) {
    throw new ActionInputError("El enlace no es válido. Debe empezar por https:// o http://.");
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
async function addResourceFileActionImpl(formData: FormData) {
  const patientId = String(formData.get("patientId") ?? "");
  const { pro } = await requireOwnedPatient(patientId);
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "pdf");
  const pathInput = String(formData.get("file_path") ?? "");
  if (!title || !pathInput) {
    throw new ActionInputError("Faltan datos del recurso.");
  }

  const supabase = await createClient();
  const path = await requireUploadedFile(pathInput, "files", pro.id, patientId, kind);

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

async function deleteResourceActionImpl(id: string, patientId: string) {
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
  if (!res) throw new ActionInputError("Recurso no encontrado.");
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function addResourceLinkAction(...args: Parameters<typeof addResourceLinkActionImpl>) { return runAction(() => addResourceLinkActionImpl(...args)); }

export async function addResourceFileAction(...args: Parameters<typeof addResourceFileActionImpl>) { return runAction(() => addResourceFileActionImpl(...args)); }

export async function deleteResourceAction(...args: Parameters<typeof deleteResourceActionImpl>) { return runAction(() => deleteResourceActionImpl(...args)); }
