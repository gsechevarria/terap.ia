/** Protege texto frente a fórmulas de hoja de cálculo; los números conservan su tipo. */
export function csvCell(value: string | number | null | undefined, separator = ";", decimalComma = false): string {
  let text = value == null ? "" : typeof value === "number" && decimalComma ? String(value).replace(".", ",") : String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return text.includes(separator) || /["\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
