import { type NextRequest } from "next/server";
import { getFiscalArrays } from "@/lib/queries/contabilidad";
import { getCurrentProfessional } from "@/lib/queries/identity";
import {
  getChecklistPersonal,
  getFacturas,
  getResumenExpediente,
  getRetenciones,
} from "@/lib/queries/expediente";
import { buildCsv, buildPdf, buildXlsx } from "@/lib/fiscal/export-docs";
import {
  calcularResumenAnual,
  construirLibros,
  getParams,
  hayParamsExactos,
  type FiltroPeriodo,
} from "@/lib/fiscal";
import { obtenerReglas, reglasPendientes } from "@/lib/fiscal/reglas";
import { crearZip, type EntradaZip } from "@/lib/zip";
import { csvCell } from "@/lib/csv";
import { formatCurrency } from "@/lib/format";

/** El expediente lleva ingresos, proveedores y NIF: fuera de toda caché. */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

const euros = (centimos: number) => formatCurrency(centimos);

/**
 * Expediente fiscal anual en un ZIP.
 *
 * INSTANTÁNEA CONSISTENTE: todo se lee y se construye en una sola pasada, de
 * modo que el PDF, el Excel y los CSV del mismo archivo cuadran entre sí aunque
 * alguien edite un gasto mientras se descarga. Ese era el requisito difícil y
 * es la razón de construirlo en memoria en vez de por streaming.
 *
 * NO afirma compatibilidad con la importación de la AEAT: no se ha implementado
 * ni validado ningún formato oficial, y decirlo sin haberlo hecho sería la clase
 * de promesa que revienta en manos del gestor.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ejercicio: string }> },
) {
  // Los route handlers NO ejecutan layouts: aunque viva bajo /pro, esta ruta no
  // hereda la guardia de ProLayout. La sesión se comprueba aquí.
  const pro = await getCurrentProfessional();
  if (!pro) return new Response("No autorizado", { status: 401, headers: NO_STORE });

  const { ejercicio: crudo } = await params;
  const ejercicio = Number.parseInt(crudo, 10);
  if (!Number.isInteger(ejercicio) || ejercicio < 2015 || ejercicio > 2100) {
    return new Response("Ejercicio no válido", { status: 400, headers: NO_STORE });
  }

  const filtro: FiltroPeriodo = { ejercicio };
  const momento = new Date();

  const [datos, resumenExp, facturas, retenciones, checklist] = await Promise.all([
    getFiscalArrays(ejercicio),
    getResumenExpediente(ejercicio),
    getFacturas(ejercicio),
    getRetenciones(ejercicio),
    getChecklistPersonal(ejercicio),
  ]);

  const parametros = getParams(ejercicio);
  const libros = construirLibros(datos, filtro, parametros);
  const resumenAnual = calcularResumenAnual(datos, ejercicio, parametros);
  // Mismo territorio y misma confirmación que usa el asistente: si aquí se
  // recalculara desde otra columna, el ZIP podría llevar reglas distintas de
  // las que el profesional ha visto en pantalla.
  const reglas = obtenerReglas(
    ejercicio,
    resumenExp.territorio,
    !resumenExp.territorioAsumido,
  );

  // --- Advertencias: lo que el gestor debe saber ANTES de usar las cifras ----
  const advertencias: string[] = [];
  if (datos.excluidos.ingresos > 0) {
    advertencias.push(
      `${datos.excluidos.ingresos} cobros sin tratamiento fiscal confirmado NO están incluidos en ninguna cifra.`,
    );
  }
  if (datos.excluidos.gastos > 0) {
    advertencias.push(
      `${datos.excluidos.gastos} gastos sin IVA recuperable NO están incluidos.`,
    );
  }
  if (datos.excluidos.bienes > 0) {
    advertencias.push(
      `${datos.excluidos.bienes} bienes de inversión pendientes de revisar NO amortizan aquí.`,
    );
  }
  if (!hayParamsExactos(ejercicio)) {
    advertencias.push(
      `No hay parámetros fiscales confirmados para ${ejercicio}: se usan los del último ejercicio disponible.`,
    );
  }
  for (const pendiente of reglasPendientes(reglas)) advertencias.push(pendiente);
  for (const paso of resumenExp.pasos.filter((p) => !p.completo)) {
    advertencias.push(`Paso «${paso.titulo}» incompleto: ${paso.faltan.join("; ") || "sin detalle"}`);
  }

  const completo = advertencias.length === 0;

  // --- Manifiesto -----------------------------------------------------------
  const manifiesto = {
    generado: momento.toISOString(),
    ejercicio,
    estado_expediente: resumenExp.expediente?.estado ?? "sin abrir",
    revisado_por: resumenExp.expediente?.revisado_por ?? null,
    revisado_at: resumenExp.expediente?.revisado_at ?? null,
    territorio: reglas.territorio,
    territorio_confirmado: !reglas.territorioAsumido,
    reglas: {
      soportadas: reglas.soportado,
      version_parametros: parametros.ejercicio,
      exactas_para_el_ejercicio: hayParamsExactos(ejercicio),
    },
    filtros: { periodo: "anual", ejercicio },
    recuentos: {
      facturas: facturas.length,
      retenciones: retenciones.length,
      checklist_respondido: checklist.filter((c) => c.aplica !== null).length,
      excluidos: datos.excluidos,
    },
    expediente_completo: completo,
    advertencias,
    // Se dice explícitamente lo que NO es, porque es la confusión previsible.
    incluye_justificantes: false,
    no_apto_para: [
      "Presentación ante la AEAT",
      "Importación en programas de la AEAT: no se ha implementado ningún formato oficial",
      "Cálculo de la cuota de la renta personal",
    ],
  };

  // --- Índice legible -------------------------------------------------------
  const indice = [
    `EXPEDIENTE FISCAL ${ejercicio} — terap.ia`,
    `Generado: ${momento.toLocaleString("es-ES")}`,
    "",
    completo
      ? "Estado: sin advertencias."
      : `⚠ EXPEDIENTE INCOMPLETO — ${advertencias.length} advertencias. Ver advertencias.txt`,
    "",
    "CONTENIDO",
    "  resumen.pdf .................................. Resumen fiscal orientativo del ejercicio",
    "  libros.xlsx .................................. Libros registro por hojas, más resumen",
    "  libros.csv ................................... Los mismos libros, texto separado por ;",
    "  registros/facturas-emitidas.csv .............. Libro registro de facturas anotadas",
    "  registros/retenciones-pagos-cuenta.csv ....... Retenciones soportadas y practicadas, y pagos a cuenta",
    "  registros/documentacion-personal.csv ......... Checklist de documentación de la renta personal",
    "  advertencias.txt ............................. Qué queda fuera de las cifras y por qué",
    "  nota-para-el-gestor.txt ...................... Dudas y ajustes anotados por el profesional",
    "  manifiesto.json .............................. Ejercicio, fecha, versión de reglas, filtros y advertencias",
    "",
    "QUÉ NO LLEVA",
    "  Justificantes ni facturas escaneadas. Los ficheros adjuntos a gastos y",
    "  facturas siguen en la aplicación y se descargan desde cada registro; no",
    "  se empaquetan aquí para no enviar decenas de megabytes sin pedirlos.",
    "  Tampoco lleva ningún documento clínico: el expediente fiscal y la",
    "  documentación de los pacientes están separados por diseño.",
    "",
    "QUÉ NO ES",
    "  No es una declaración ni sirve para presentar ante la AEAT.",
    "  No calcula la cuota de la renta personal.",
    "  No se ha implementado ningún formato de importación oficial.",
    "",
    "CIFRAS PRINCIPALES (solo lo confirmado)",
    `  Ingresos computables ....... ${euros(resumenExp.totales.ingresosConfirmadosCents)}`,
    `  Gastos confirmados ......... ${euros(resumenExp.totales.gastosConfirmadosCents)}`,
    `  Retenciones soportadas ..... ${euros(resumenExp.totales.retencionesSoportadasCents)}`,
    `  Pagos fraccionados ......... ${euros(resumenExp.totales.pagosFraccionadosCents)}`,
    "",
    "OBLIGACIONES FORMALES",
    ...resumenExp.obligaciones.map(
      (o) =>
        `  Modelo ${o.modelo.padEnd(4)} ${o.determinacion.padEnd(12)} ${o.explicacion}`,
    ),
  ].join("\r\n");

  // --- CSV auxiliares -------------------------------------------------------
  // `csvCell` neutraliza las fórmulas: una celda que empiece por = + - o @ se
  // ejecutaría al abrir el fichero en Excel.
  const filaCsv = (celdas: (string | number | null)[]) =>
    celdas.map((c) => csvCell(c ?? "", ";", true)).join(";");

  const csvFacturas = [
    "﻿" +
      filaCsv([
        "Serie", "Número", "Tipo", "Fecha emisión", "Destinatario", "NIF",
        "Tipo destinatario", "Servicio", "Base", "Tratamiento IVA", "Tipo IVA",
        "Cuota IVA", "Retención", "Total", "Estado",
      ]),
    ...facturas.map((f) =>
      filaCsv([
        f.serie, f.numero, f.tipo, f.fecha_emision, f.destinatario_nombre,
        f.destinatario_nif, f.destinatario_tipo, f.categoria_servicio,
        (f.base_cents / 100).toFixed(2).replace(".", ","),
        f.tratamiento_iva, f.tipo_iva,
        ((f.cuota_iva_cents ?? 0) / 100).toFixed(2).replace(".", ","),
        ((f.retencion_cents ?? 0) / 100).toFixed(2).replace(".", ","),
        (f.total_cents / 100).toFixed(2).replace(".", ","),
        f.estado,
      ]),
    ),
  ].join("\r\n");

  const csvRetenciones = [
    "﻿" + filaCsv(["Clase", "Modelo", "Periodo", "Fecha", "Importe", "Notas"]),
    ...retenciones.map((r) =>
      filaCsv([
        r.clase, r.modelo, r.periodo, r.fecha,
        (r.importe_cents / 100).toFixed(2).replace(".", ","),
        r.notas,
      ]),
    ),
  ].join("\r\n");

  const csvChecklist = [
    "﻿" + filaCsv(["Elemento", "Aplica", "Aportado", "Notas"]),
    ...checklist.map((c) =>
      filaCsv([
        c.clave,
        // Tres estados también en la exportación: sin responder no es "no".
        c.aplica === null ? "sin responder" : c.aplica ? "sí" : "no",
        c.aportado ? "sí" : "no",
        c.notas,
      ]),
    ),
  ].join("\r\n");

  const xlsx = buildXlsx(libros, resumenAnual, filtro);
  const pdf = await buildPdf(resumenAnual, filtro);

  const entradas: EntradaZip[] = [
    { nombre: "indice.txt", contenido: "﻿" + indice },
    { nombre: "manifiesto.json", contenido: JSON.stringify(manifiesto, null, 2) },
    {
      nombre: "advertencias.txt",
      contenido:
        "﻿" +
        (completo
          ? "Sin advertencias: todas las cifras provienen de registros confirmados.\r\n"
          : [
              "ADVERTENCIAS DEL EXPEDIENTE",
              "",
              "Las cifras de este expediente NO incluyen lo siguiente:",
              "",
              ...advertencias.map((a) => `  · ${a}`),
            ].join("\r\n")),
    },
    {
      nombre: "nota-para-el-gestor.txt",
      contenido:
        "﻿" +
        (resumenExp.expediente?.nota_gestor ?? "Sin nota del profesional.\r\n"),
    },
    { nombre: "resumen.pdf", contenido: pdf },
    { nombre: "libros.xlsx", contenido: xlsx },
    { nombre: "libros.csv", contenido: buildCsv(libros, resumenAnual, filtro) },
    { nombre: "registros/facturas-emitidas.csv", contenido: csvFacturas },
    { nombre: "registros/retenciones-pagos-cuenta.csv", contenido: csvRetenciones },
    { nombre: "registros/documentacion-personal.csv", contenido: csvChecklist },
  ];

  const zip = crearZip(entradas, momento);

  // El nombre dice si está incompleto: quien lo reenvíe al gestor no debería
  // tener que abrirlo para saberlo.
  const sufijo = completo ? "" : "-INCOMPLETO";
  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="expediente-fiscal-${ejercicio}${sufijo}.zip"`,
      ...NO_STORE,
    },
  });
}
