import { ActionInputError } from "@/lib/action-result";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const RECEIPT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const FILE_MIME = [...RECEIPT_MIME, "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"];
export function validateUpload(bucket: string, size: number, mime: string) {
  if (!["files", "receipts"].includes(bucket) || !Number.isInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES || !(bucket === "receipts" ? RECEIPT_MIME : FILE_MIME).includes(mime)) {
    throw new ActionInputError("Formato no admitido o archivo superior a 20 MB.");
  }
}
