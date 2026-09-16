import "server-only";

/**
 * Plantillas del correo transaccional.
 *
 * Lo que estos mensajes NO llevan, y es deliberado: ni diagnósticos, ni
 * etiquetas clínicas, ni tareas, ni citas, ni el nombre del profesional, ni
 * una sola palabra del expediente. Un correo acaba en bandejas compartidas,
 * en previsualizaciones de la pantalla de bloqueo y en copias de seguridad de
 * terceros. Lo único que dicen es qué centro invita y que hay que activar el
 * acceso.
 *
 * El HTML va con estilos en línea porque los clientes de correo descartan las
 * hojas de estilo, y sin imágenes remotas para no filtrar la apertura.
 */

const TINTA = "#18252b";
const SUAVE = "#626c73";
const ACENTO = "#153d45";
const LINEA = "#e8ecee";

function marco(contenido: string, pie: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
<tr><td style="background:#ffffff;border:1px solid ${LINEA};border-radius:16px;padding:32px">
${contenido}
</td></tr>
<tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${SUAVE}">${pie}</td></tr>
</table></body></html>`;
}

function boton(url: string, texto: string): string {
  return `<a href="${url}" style="display:inline-block;background:${ACENTO};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:10px">${texto}</a>`;
}

/** Escapa lo que venga de la base de datos antes de meterlo en el HTML. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function caduca(expiraEn: string): string {
  return new Date(expiraEn).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Invitación del paciente a activar su acceso. */
export function invitacionPaciente(opciones: {
  organizacion: string;
  url: string;
  expiraEn: string;
}) {
  const org = esc(opciones.organizacion);
  const fecha = caduca(opciones.expiraEn);
  return {
    asunto: `${opciones.organizacion} te invita a Terap`,
    texto: [
      `${opciones.organizacion} te ha invitado a activar tu acceso en Terap.`,
      "",
      `Activa tu acceso aquí: ${opciones.url}`,
      "",
      `El enlace caduca el ${fecha} y solo sirve una vez.`,
      "",
      "Si no esperabas esta invitación, no hagas nada: sin activarla no se crea",
      "ningún acceso. Puedes avisar al centro que aparece arriba.",
    ].join("\n"),
    html: marco(
      `<p style="margin:0 0 8px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${SUAVE}">Terap</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700">${org} te invita a Terap</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${SUAVE}">Podrás ver tus citas, escribir en tu diario y responder lo que te pida tu profesional, desde el móvil.</p>
${boton(opciones.url, "Activar mi acceso")}
<p style="margin:24px 0 0;font-size:13px;line-height:1.65;color:${SUAVE}">El enlace caduca el <strong style="color:${TINTA}">${fecha}</strong> y solo sirve una vez.</p>`,
      `<strong>¿No esperabas esta invitación?</strong> No hagas nada: sin activarla no se crea ningún acceso. Si crees que es un error, avisa a ${org}.`,
    ),
  };
}

/** Invitación a un profesional para incorporarse a un centro. */
export function invitacionProfesional(opciones: {
  organizacion: string;
  url: string;
  expiraEn: string;
  rol: string;
}) {
  const org = esc(opciones.organizacion);
  const fecha = caduca(opciones.expiraEn);
  const rol = opciones.rol === "owner" ? "propietario" : opciones.rol === "admin" ? "administrador" : "profesional";
  return {
    asunto: `${opciones.organizacion} te invita a su equipo en Terap`,
    texto: [
      `${opciones.organizacion} te ha invitado a incorporarte a su equipo en Terap como ${rol}.`,
      "",
      `Acepta la invitación aquí: ${opciones.url}`,
      "",
      `El enlace caduca el ${fecha} y solo sirve una vez.`,
      "",
      "Si no esperabas esta invitación, no hagas nada.",
    ].join("\n"),
    html: marco(
      `<p style="margin:0 0 8px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${SUAVE}">Terap</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700">${org} te invita a su equipo</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${SUAVE}">Te incorporarías como <strong style="color:${TINTA}">${rol}</strong>. Los expedientes a los que tengas acceso se te asignan uno a uno: entrar en el equipo no abre ninguno.</p>
${boton(opciones.url, "Aceptar la invitación")}
<p style="margin:24px 0 0;font-size:13px;line-height:1.65;color:${SUAVE}">El enlace caduca el <strong style="color:${TINTA}">${fecha}</strong> y solo sirve una vez.</p>`,
      `<strong>¿No esperabas esta invitación?</strong> No hagas nada: sin aceptarla no se te añade a ningún equipo.`,
    ),
  };
}
