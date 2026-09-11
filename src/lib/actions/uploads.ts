"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient, requireProfessional } from "@/lib/queries/identity";
import { validateUpload } from "@/lib/upload-policy";
async function prepareUploadActionImpl(input: { bucket: "files" | "receipts"; patientId?: string; size: number; mime: string }) {
  validateUpload(input.bucket, input.size, input.mime);
  const pro = input.bucket === "files" ? (await requireOwnedPatient(input.patientId ?? "")).pro : await requireProfessional();
  const path = `${input.bucket === "files" ? input.patientId : pro.id}/${crypto.randomUUID()}`;
  const supabase = await createClient();
  const pending = await supabase.from("pending_uploads").insert({
    path, bucket: input.bucket, professional_id: pro.id, patient_id: input.patientId ?? null, size_bytes: input.size, mime: input.mime,
  });
  if (pending.error) throw new ActionInputError("No se pudo preparar el archivo.");
  const { data, error } = await supabase.storage.from(input.bucket).createSignedUploadUrl(path);
  if (error) throw new ActionInputError("No se pudo autorizar la subida.");
  return { path, token: data.token };
}

export async function prepareUploadAction(...args: Parameters<typeof prepareUploadActionImpl>) { return runAction(() => prepareUploadActionImpl(...args)); }
