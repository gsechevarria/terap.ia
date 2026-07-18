// Generación de archivos .ics (iCalendar) para descargar/adjuntar citas.

function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
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
  return lines.join("\r\n");
}
