// Generación de archivos .ics (iCalendar) para descargar/adjuntar citas.

function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * Escapado de TEXT según RFC 5545 §3.3.11.
 *
 * Faltaba el `\r`: unas notas con retornos de carro (habituales si se pegan
 * desde Word o desde otro sistema) dejaban un CR suelto dentro del valor, y ahí
 * el CR es parte del CRLF que separa líneas — algunos clientes rechazan el
 * fichero entero. Se normaliza CRLF y CR a `\n` antes de escapar.
 */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Plegado de líneas a 75 OCTETOS (RFC 5545 §3.1), no a 75 caracteres.
 *
 * La distinción importa: los nombres de pacientes llevan acentos y eñes, que en
 * UTF-8 ocupan dos bytes. Contando caracteres se generarían líneas de hasta 150
 * octetos, por encima del límite. Además, el corte no puede caer en mitad de
 * una secuencia multibyte o el fichero queda con UTF-8 inválido.
 *
 * Las líneas de continuación empiezan por un espacio.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  // La primera línea admite 75 octetos; las siguientes 74, porque el espacio
  // inicial de continuación cuenta.
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Retrocede hasta el inicio de un carácter (los bytes de continuación de
    // UTF-8 son 10xxxxxx).
    if (end < bytes.length) {
      while (end > start && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
    }
    const chunk = bytes.subarray(start, end).toString("utf8");
    out.push(out.length === 0 ? chunk : ` ${chunk}`);
    start = end;
    limit = 74;
  }
  return out.join("\r\n");
}

export function buildICS(opts: {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description?: string | null;
  url?: string | null;
  cancelled?: boolean;
}): string {
  const now = icsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//terap.ia//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@terap.ia`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(opts.start)}`,
    `DTEND:${icsDate(opts.end)}`,
    `SUMMARY:${esc(opts.summary)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : null,
    opts.url ? `URL:${esc(opts.url)}` : null,
    `STATUS:${opts.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  // RFC 5545 exige además que el fichero termine en CRLF.
  return lines.map(fold).join("\r\n") + "\r\n";
}
