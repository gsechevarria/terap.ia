import { ActionInputError } from "@/lib/action-result";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/upload-policy";
export async function requireUploadedFile(path: string, bucket: "files" | "receipts", proId: string, patientId?: string, resourceKind?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pending_uploads").select("*").eq("path", path).eq("bucket", bucket).eq("professional_id", proId).maybeSingle();
  if (error || !data || data.patient_id !== (patientId ?? null)) throw new ActionInputError("Archivo no disponible.");
  validateUpload(bucket, data.size_bytes, data.mime);
  if (resourceKind && !(resourceKind === "pdf" ? data.mime === "application/pdf" : resourceKind === "audio" && data.mime.startsWith("audio/"))) throw new ActionInputError("El tipo de recurso no coincide con el archivo.");
  const info = await supabase.storage.from(bucket).info(path);
  if (info.error || !info.data) throw new ActionInputError("La subida del archivo no se ha completado.");
  if (info.data.metadata?.size !== data.size_bytes || info.data.metadata?.mimetype !== data.mime) throw new ActionInputError("El archivo no coincide con la subida autorizada.");
  return path;
}
