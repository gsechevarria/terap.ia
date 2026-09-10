"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { requireUploadedFile } from "@/lib/upload-server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";

/** El profesional sube un documento al repositorio del paciente (Storage). */
async function addDocumentActionImpl(formData: FormData) {
  const patientId = String(formData.get("patientId") ?? "");
  // El patientId venía del FormData sin validar propiedad: solo lo frenaba, de
  // rebote, la RLS de Storage.
  const { pro, patient } = await requireOwnedPatient(patientId);

  const title = String(formData.get("title") ?? "").trim();
  const pathInput = String(formData.get("file_path") ?? "");
  if (!pathInput) throw new ActionInputError("Falta el archivo.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = await requireUploadedFile(pathInput, "files", pro.id, patientId);

  const { error } = await supabase.from("documents").insert({
    professional_id: pro.id,
    patient_id: patient.id,
    title: title || String(formData.get("file_name") ?? "Documento"),
    storage_path: path,
    uploaded_by: user?.id ?? null,
    // Explícito aunque el default ya sea false: los documentos del expediente
    // no se comparten con el paciente salvo decisión del profesional.
    shared_with_patient: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

/** Borra un documento (fila + binario). Antes no comprobaba ni sesión ni rol. */
async function deleteDocumentActionImpl(id: string, patientId: string) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("patient_id", patientId)
    .eq("professional_id", pro.id)
    .maybeSingle();
  if (!doc) throw new ActionInputError("Documento no encontrado.");

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

/**
 * Comparte (o deja de compartir) un documento con el paciente.
 *
 * El flag `shared_with_patient` existía desde 20260725090001 pero no había
 * ninguna interfaz para activarlo: todos los documentos estaban en `false`, es
 * decir, privados por diseño del profesional. Nota legal: la Ley 41/2002
 * art. 18.3 restringe el acceso del paciente a las anotaciones subjetivas del
 * profesional y a los datos de terceros, así que el reparto es deliberado y por
 * documento, nunca masivo.
 */
async function setDocumentSharedActionImpl(
  id: string,
  patientId: string,
  shared: boolean,
) {
  const { pro } = await requireOwnedPatient(patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ shared_with_patient: shared })
    .eq("id", id)
    .eq("patient_id", patientId)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
  revalidatePath("/app/resources");
}

export async function addDocumentAction(...args: Parameters<typeof addDocumentActionImpl>) { return runAction(() => addDocumentActionImpl(...args)); }

export async function deleteDocumentAction(...args: Parameters<typeof deleteDocumentActionImpl>) { return runAction(() => deleteDocumentActionImpl(...args)); }

export async function setDocumentSharedAction(...args: Parameters<typeof setDocumentSharedActionImpl>) { return runAction(() => setDocumentSharedActionImpl(...args)); }
