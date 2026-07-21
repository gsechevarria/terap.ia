import { type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getFiscalArrays } from "@/lib/queries/contabilidad";
import {
  construirLibros,
  calcularResumenAnual,
  getParams,
  CATEGORIA_LABEL,
  DESCARGO_FISCAL,
  type CategoriaGasto,
  type FiltroPeriodo,
  type Libro,
  type ResumenAnual,
  type Trimestre,
} from "@/lib/fiscal";

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

function periodoLabel(f: FiltroPeriodo): string {
  return f.trimestre ? `${f.trimestre}T ${f.ejercicio}` : `Año ${f.ejercicio}`;
}

// --- Hoja/bloque resumen (compartido por XLSX y PDF) ------------------------
function resumenFilas(r: ResumenAnual, f: FiltroPeriodo): [string, string][] {
  const filas: [string, string][] = [
    ["Ejercicio", String(r.ejercicio)],
    ["Periodo", periodoLabel(f)],
    ["Ingresos del año", eur(r.ingresosTotales)],
    ["Gastos corrientes deducibles", eur(r.gastosCorrientes)],
    ["Amortizaciones", eur(r.amortizacionesTotales)],
    ["Gastos deducibles totales", eur(r.gastosDeduciblesTotales)],
    ["Gastos de difícil justificación", eur(r.gastosDificilJustificacion)],
    ["Rendimiento neto", eur(r.rendimientoNeto)],
    ["Retenciones soportadas", eur(r.retencionesSoportadas)],
    ["Pagos fraccionados (suma 4T)", eur(r.pagosFraccionados)],
  ];
  for (const t of r.trimestres) {
    filas.push([`Modelo 130 · ${t.trimestre}T (pago estimado)`, eur(t.pagoTrimestre)]);
  }
  return filas;
}

// --- XLSX -------------------------------------------------------------------
function sheetName(nombre: string): string {
  return nombre.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
}

function buildXlsx(libros: Libro[], resumen: ResumenAnual, f: FiltroPeriodo): Buffer {
  const wb = XLSX.utils.book_new();

  const resumenAoa: (string | number)[][] = [
    ["Contabilidad — resumen fiscal (orientativo)"],
    [DESCARGO_FISCAL],
    [],
    ...resumenFilas(resumen, f),
    [],
    ["Desglose de gastos por categoría"],
    ["Categoría", "Base", "Cuota IVA", "Total", "Deducible"],
    ...resumen.gastosPorCategoria.map((c) => [
      CATEGORIA_LABEL[c.categoria as CategoriaGasto],
      c.base,
      c.cuotaIva,
      c.total,
      c.deducible,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(resumenAoa),
    "Resumen",
  );

  for (const libro of libros) {
    const ws = XLSX.utils.aoa_to_sheet([libro.headers, ...libro.rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(libro.nombre));
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// --- CSV (separador ; · decimales con coma · BOM) ---------------------------
function csvCell(v: string | number): string {
  const s =
    typeof v === "number" ? String(v).replace(".", ",") : v.replace(/"/g, '""');
  return /[";\n]/.test(s) ? `"${s}"` : s;
}
function csvLibro(libro: Libro): string {
  const lines = [
    libro.nombre,
    libro.headers.map(csvCell).join(";"),
    ...libro.rows.map((r) => r.map(csvCell).join(";")),
  ];
  return lines.join("\r\n");
}
function buildCsv(libros: Libro[], resumen: ResumenAnual, f: FiltroPeriodo): string {
  const bloques = [
    ["Resumen fiscal (orientativo)", DESCARGO_FISCAL].join("\r\n"),
    resumenFilas(resumen, f)
      .map(([k, v]) => `${csvCell(k)};${csvCell(v)}`)
      .join("\r\n"),
    ...libros.map(csvLibro),
  ];
  return "﻿" + bloques.join("\r\n\r\n");
}

// --- PDF (resumen legible) --------------------------------------------------
async function buildPdf(resumen: ResumenAnual, f: FiltroPeriodo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]); // A4 en puntos
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.12, 0.14);
  const soft = rgb(0.45, 0.45, 0.5);
  const M = 56;
  let y = 786;

  const line = (text: string, opts: { size?: number; b?: boolean; color?: typeof ink } = {}) => {
    const size = opts.size ?? 11;
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 786;
    }
    page.drawText(text, {
      x: M,
      y,
      size,
      font: opts.b ? bold : font,
      color: opts.color ?? ink,
    });
    y -= size + 7;
  };
  const kv = (k: string, v: string) => {
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 786;
    }
    page.drawText(k, { x: M, y, size: 11, font, color: soft });
    page.drawText(v, { x: 340, y, size: 11, font: bold, color: ink });
    y -= 18;
  };

  line("Contabilidad — resumen fiscal", { size: 18, b: true });
  line(`Periodo: ${periodoLabel(f)}`, { size: 11, color: soft });
  y -= 4;
  line(DESCARGO_FISCAL, { size: 8.5, color: soft });
  y -= 8;

  for (const [k, v] of resumenFilas(resumen, f)) kv(k, v);

  y -= 10;
  line("Gastos por categoría", { size: 13, b: true });
  for (const c of resumen.gastosPorCategoria) {
    kv(CATEGORIA_LABEL[c.categoria as CategoriaGasto], eur(c.deducible));
  }

  return doc.save();
}

// --- Handler ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const formato = sp.get("formato") ?? "xlsx";
  const ejercicio = Number.parseInt(sp.get("ejercicio") ?? "", 10);
  const periodoRaw = sp.get("periodo") ?? "anual";

  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    return new Response("Ejercicio no válido", { status: 400 });
  }
  const trimestre =
    periodoRaw === "1" || periodoRaw === "2" || periodoRaw === "3" || periodoRaw === "4"
      ? (Number(periodoRaw) as Trimestre)
      : undefined;
  const filtro: FiltroPeriodo = { ejercicio, trimestre };

  const params = getParams(ejercicio);
  const data = await getFiscalArrays(ejercicio);
  const libros = construirLibros(data, filtro, params);
  const resumen = calcularResumenAnual(data, ejercicio, params);

  const suffix = trimestre ? `-${trimestre}T` : "";
  const baseName = `contabilidad-${ejercicio}${suffix}`;

  if (formato === "csv") {
    return new Response(buildCsv(libros, resumen, filtro), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }
  if (formato === "pdf") {
    const bytes = await buildPdf(resumen, filtro);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }
  // xlsx por defecto
  const buf = buildXlsx(libros, resumen, filtro);
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
    },
  });
}
