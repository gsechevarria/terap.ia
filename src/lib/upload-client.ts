"use client";
import { callAction } from "@/lib/action-result";

import { createClient } from "@/lib/supabase/client";
import { prepareUploadAction } from "@/lib/actions/uploads";
import { validateUpload } from "@/lib/upload-policy";
/** El binario va directamente a Storage; la Server Action solo recibe metadatos. */
export async function uploadFormFile(fd: FormData, field: "file" | "adjunto", bucket: "files" | "receipts") {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return;
  validateUpload(bucket, file.size, file.type);
  const signed = await callAction(prepareUploadAction, { bucket, patientId: bucket === "files" ? String(fd.get("patientId")) : undefined, size: file.size, mime: file.type });
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) throw new Error("No se pudo subir el archivo. Inténtalo de nuevo.");
  fd.set(`${field}_path`, signed.path);
  fd.set(`${field}_name`, file.name);
  fd.delete(field);
}
