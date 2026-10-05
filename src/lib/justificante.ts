/*
 * Justificante de asistencia a consulta de psicología (PDF, A4, una página).
 *
 * Acredita ÚNICAMENTE que el paciente acudió: ni diagnóstico, ni motivo de
 * consulta, ni tratamiento, ni notas. Por eso la función recibe un tipo cerrado
 * con nombres, fecha y hora, y no la cita: así no hay manera de que un campo
 * clínico acabe impreso por descuido.
 *
 * No es una factura ni se parece a una: no lleva importes ni numeración.
 *
 * La firma y el sello se dejan en blanco para que los ponga el profesional. La
 * localidad no está en el esquema, así que va como campo rellenable del PDF (y
 * con línea para escribirla a mano si se imprime). Lo mismo el número de
 * colegiación cuando la ficha del profesional no lo tiene.
 */
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { wallClockParts } from "@/lib/tz";

export type DatosJustificante = {
  profesional: string;
  numeroColegiado: string | null;
  paciente: string;
  /** Inicio de la cita (ISO); se imprime en hora de Madrid. */
  inicioISO: string;
  /** Instante de emisión; se imprime en hora de Madrid. */
  emitidoISO: string;
};

const p2 = (n: number) => String(n).padStart(2, "0");

/** DD/MM/AAAA y HH:MM en hora de Madrid, no en la del servidor (UTC). */
export function fechaHoraMadrid(iso: string): { fecha: string; hora: string } {
  const w = wallClockParts(new Date(iso));
  return { fecha: `${p2(w.d)}/${p2(w.m)}/${w.y}`, hora: `${p2(w.hh)}:${p2(w.mm)}` };
}

/** Sustituciones para letras que WinAnsi no tiene y que no se descomponen. */
const SIN_DESCOMPOSICION: Record<string, string> = {
  Ł: "L", ł: "l", Đ: "D", đ: "d", Ħ: "H", ħ: "h", ı: "i", Ŀ: "L", ŀ: "l",
};

/**
 * Las fuentes estándar del PDF solo codifican WinAnsi: «Łukasz» haría fallar
 * la generación entera. Cada carácter que no cabe se translitera (quitando
 * diacríticos, o con la tabla de arriba); solo en último extremo se omite.
 */
export function textoImprimible(texto: string, font: PDFFont): string {
  let out = "";
  for (const ch of texto.normalize("NFC").replace(/\s+/g, " ").trim()) {
    const candidatos = [
      ch,
      ch.normalize("NFD").replace(/\p{M}/gu, ""),
      SIN_DESCOMPOSICION[ch] ?? "",
    ];
    for (const c of candidatos) {
      if (!c) continue;
      try {
        font.encodeText(c);
        out += c;
        break;
      } catch {
        /* siguiente candidato */
      }
    }
  }
  return out;
}

export async function buildJustificantePdf(datos: DatosJustificante): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Justificante de asistencia a consulta de psicología");
  doc.setLanguage("es-ES");
  doc.setCreator("Terap");
  doc.setProducer("Terap");

  const W = 595.28;
  const H = 841.89;
  const page = doc.addPage([W, H]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const negro = rgb(0, 0, 0);
  const gris = rgb(0.35, 0.35, 0.35);
  const form = doc.getForm();

  const M = 72; // márgenes amplios: 2,54 cm
  const ANCHO = W - 2 * M;
  const CUERPO = 11.5;
  const INTERLINEA = 19;
  let y = H - 96;

  const profesional = textoImprimible(datos.profesional, bold) || "—";
  const paciente = textoImprimible(datos.paciente, bold) || "—";
  const colegiado = datos.numeroColegiado
    ? textoImprimible(datos.numeroColegiado, bold)
    : "";
  const cita = fechaHoraMadrid(datos.inicioISO);
  const emision = fechaHoraMadrid(datos.emitidoISO);

  /* Título centrado. */
  const titulo = ["JUSTIFICANTE DE ASISTENCIA", "A CONSULTA DE PSICOLOGÍA"];
  for (const t of titulo) {
    const size = 17;
    page.drawText(t, {
      x: (W - bold.widthOfTextAtSize(t, size)) / 2,
      y,
      size,
      font: bold,
      color: negro,
    });
    y -= 24;
  }
  y -= 6;
  page.drawLine({
    start: { x: M, y },
    end: { x: W - M, y },
    thickness: 0.8,
    color: negro,
  });
  y -= 44;

  /*
   * Párrafo con tramos de distinto peso: los datos van en negrita para que se
   * vea de un vistazo qué es cada cosa. Ajuste de línea propio, palabra a
   * palabra, porque pdf-lib no compone texto.
   */
  type Tramo = { t: string; b?: boolean };
  const parrafo = (tramos: Tramo[]) => {
    // Cada «palabra» es un grupo de trozos sin espacio entre ellos, para que la
    // puntuación vaya pegada a lo anterior y salte de línea con ello: «Concepción,»
    // y nunca una coma sola al principio de una línea.
    type Trozo = { w: string; f: PDFFont };
    const palabras: Trozo[][] = [];
    for (const tr of tramos) {
      for (const w of tr.t.split(" ").filter(Boolean)) {
        const trozo = { w, f: tr.b ? bold : regular };
        const previa = palabras.at(-1);
        if (/^[,.;:]/.test(w) && previa) previa.push(trozo);
        else palabras.push([trozo]);
      }
    }
    const esp = regular.widthOfTextAtSize(" ", CUERPO);
    const anchoDe = (p: Trozo[]) =>
      p.reduce((a, t) => a + t.f.widthOfTextAtSize(t.w, CUERPO), 0);
    let x = M;
    for (const palabra of palabras) {
      if (x > M && x + anchoDe(palabra) > M + ANCHO) {
        x = M;
        y -= INTERLINEA;
      }
      for (const { w, f } of palabra) {
        page.drawText(w, { x, y, size: CUERPO, font: f, color: negro });
        x += f.widthOfTextAtSize(w, CUERPO);
      }
      x += esp;
    }
    y -= INTERLINEA;
  };

  /** Campo rellenable sobre una línea, para lo que el esquema no guarda. */
  const campo = (nombre: string, x: number, yBase: number, ancho: number) => {
    page.drawLine({
      start: { x, y: yBase - 3 },
      end: { x: x + ancho, y: yBase - 3 },
      thickness: 0.6,
      color: gris,
    });
    const f = form.createTextField(nombre);
    f.addToPage(page, {
      x,
      y: yBase - 2,
      width: ancho,
      height: 15,
      borderWidth: 0,
      borderColor: undefined,
      backgroundColor: undefined,
      font: regular,
    });
    f.setFontSize(CUERPO);
  };

  /* Profesional y colegiación. */
  if (colegiado) {
    parrafo([
      { t: "D./Dña." },
      { t: profesional, b: true },
      { t: ", psicólogo/a, con número de colegiación" },
      { t: colegiado, b: true },
      { t: "," },
    ]);
  } else {
    parrafo([
      { t: "D./Dña." },
      { t: profesional, b: true },
      { t: ", psicólogo/a, con número de colegiación:" },
    ]);
    // Opcional: si no hay número en la ficha, se deja hueco para escribirlo.
    campo("numero_colegiacion", M, y, 180);
    y -= INTERLINEA;
  }

  y -= 14;
  page.drawText("HACE CONSTAR:", { x: M, y, size: CUERPO + 0.5, font: bold, color: negro });
  y -= INTERLINEA + 14;

  parrafo([
    { t: "Que D./Dña." },
    { t: paciente, b: true },
    { t: "ha asistido a consulta de psicología el día" },
    { t: cita.fecha, b: true },
    { t: ", a las" },
    { t: cita.hora, b: true },
    { t: "horas." },
  ]);
  y -= 14;

  parrafo([
    {
      t: "Se expide el presente justificante a solicitud de la persona interesada, exclusivamente para acreditar su asistencia.",
    },
  ]);
  y -= 22;

  /* «En [localidad], a [fecha].» La localidad es un campo rellenable. */
  page.drawText("En", { x: M, y, size: CUERPO, font: regular, color: negro });
  const xLocalidad = M + regular.widthOfTextAtSize("En ", CUERPO);
  const anchoLocalidad = 190;
  campo("localidad", xLocalidad, y, anchoLocalidad);
  const resto = `, a ${emision.fecha}.`;
  page.drawText(resto, {
    x: xLocalidad + anchoLocalidad + 2,
    y,
    size: CUERPO,
    font: regular,
    color: negro,
  });
  page.drawText("(localidad)", {
    x: xLocalidad,
    y: y - 15,
    size: 8,
    font: regular,
    color: gris,
  });
  y -= 64;

  /* Firma y sello, en blanco. */
  const caja = (etiqueta: string, alto: number) => {
    page.drawText(etiqueta, { x: M, y, size: CUERPO, font: regular, color: negro });
    y -= 10;
    page.drawRectangle({
      x: M,
      y: y - alto,
      width: 260,
      height: alto,
      borderColor: gris,
      borderWidth: 0.6,
    });
    y -= alto + 28;
  };
  caja("Firma del profesional:", 100);
  caja("Sello del centro, si procede:", 80);

  /* Pie discreto: qué es y qué no es. */
  const pie =
    "Este documento acredita únicamente la asistencia. No contiene información clínica.";
  page.drawText(pie, {
    x: (W - regular.widthOfTextAtSize(pie, 8.5)) / 2,
    y: 48,
    size: 8.5,
    font: regular,
    color: gris,
  });

  if (y < 72) {
    // Comprobación de maquetación: si algo empuja la página, mejor fallar aquí
    // que entregar un justificante con la firma cortada.
    throw new Error("El justificante no cabe en una página.");
  }

  return doc.save();
}
