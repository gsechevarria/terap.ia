import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  buildJustificantePdf,
  fechaHoraMadrid,
  textoImprimible,
} from "@/lib/justificante";

const base = {
  profesional: "Lucía Romero Fernández",
  numeroColegiado: "M-12345",
  paciente: "Ana Nadal Sánchez",
  inicioISO: "2026-10-05T15:30:00.000Z",
  emitidoISO: "2026-10-06T08:00:00.000Z",
};

describe("justificante de asistencia", () => {
  it("imprime fecha y hora en Madrid, no en UTC", () => {
    expect(fechaHoraMadrid("2026-10-05T15:30:00.000Z")).toEqual({
      fecha: "05/10/2026",
      hora: "17:30",
    });
    // Invierno (CET, +1) y cambio de día por la zona.
    expect(fechaHoraMadrid("2026-12-31T23:30:00.000Z")).toEqual({
      fecha: "01/01/2027",
      hora: "00:30",
    });
  });

  it("genera un PDF de una sola página A4", async () => {
    const pdf = await PDFDocument.load(await buildJustificantePdf(base));
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("deja la localidad como campo rellenable", async () => {
    const pdf = await PDFDocument.load(await buildJustificantePdf(base));
    const nombres = pdf.getForm().getFields().map((f) => f.getName());
    expect(nombres).toEqual(["localidad"]);
  });

  it("sin número de colegiación, deja su hueco rellenable y sigue cabiendo", async () => {
    const pdf = await PDFDocument.load(
      await buildJustificantePdf({
        ...base,
        numeroColegiado: null,
        // Nombres largos: fuerzan más líneas en los dos párrafos.
        profesional: "María de los Ángeles Fernández-Villaverde de la Concepción",
        paciente: "José Antonio Martínez-Echevarría Rodríguez de Santiago",
      }),
    );
    expect(pdf.getPageCount()).toBe(1);
    const nombres = pdf.getForm().getFields().map((f) => f.getName()).sort();
    expect(nombres).toEqual(["localidad", "numero_colegiacion"]);
  });

  it("no rompe con caracteres fuera de WinAnsi", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(textoImprimible("Łukasz Dąbrowski", font)).toBe("Lukasz Dabrowski");
    expect(textoImprimible("Núñez  Peña", font)).toBe("Núñez Peña");
    await expect(
      buildJustificantePdf({ ...base, paciente: "Łukasz Ćwikła 李" }),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});
