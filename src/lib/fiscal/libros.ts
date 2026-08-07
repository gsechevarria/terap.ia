/**
 * Construcción de los LIBROS REGISTRO (AEAT) — orientativos, para que el gestor
 * los importe. Cada libro es { nombre, headers, rows } con importes en euros.
 * NO son facturas ni contabilidad oficial.
 */
import type { FiscalArrays, Trimestre } from "./types";
import { CATEGORIA_LABEL, prorrataEfectiva } from "./types";
import type { ParamsFiscales } from "./parametros";
import {
  amortizacionEjercicio,
  anioDeFecha,
  deducibleIrpf,
  redondear,
  tasaRetencion,
  trimestreDeFecha,
} from "./helpers";

export interface Libro {
  nombre: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface FiltroPeriodo {
  ejercicio: number;
  trimestre?: Trimestre; // si se omite, año completo
}

function enPeriodo(fecha: string, filtro: FiltroPeriodo): boolean {
  if (anioDeFecha(fecha) !== filtro.ejercicio) return false;
  if (filtro.trimestre && trimestreDeFecha(fecha) !== filtro.trimestre) return false;
  return true;
}

export function libroIngresos(
  data: FiscalArrays,
  filtro: FiltroPeriodo,
  params: ParamsFiscales,
): Libro {
  const tasaRet = tasaRetencion(data.config, filtro.ejercicio, params);
  const rows = data.ingresos
    .filter((i) => enPeriodo(i.fecha, filtro))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((i, idx) => {
      const retencion = i.retencionAplicable ? redondear(i.base * tasaRet) : 0;
      return [
        idx + 1,
        i.fecha.slice(0, 10),
        i.nombrePagador ?? "",
        "", // NIF del pagador (no disponible para particulares)
        "Servicios de psicología",
        i.base,
        i.tipoOperacion === "exenta" ? "Exenta (20.Uno.3º LIVA)" : "Sujeta",
        i.cuotaIva,
        retencion,
        i.total,
      ];
    });
  return {
    nombre: "Libro de ingresos",
    headers: [
      "Nº asiento",
      "Fecha",
      "Nombre pagador",
      "NIF pagador",
      "Concepto",
      "Base",
      "Tipo operación",
      "Cuota IVA",
      "Retención",
      "Total",
    ],
    rows,
  };
}

/**
 * Libro de gastos CORRIENTES.
 *
 * Los bienes de inversión se excluyen: se amortizan y van en su propio libro.
 * Antes se listaban aquí al 100 %, mientras `calcularResumenAnual` sí los
 * excluía, así que el mismo XLSX traía el portátil por 3.000 € en "Libro de
 * gastos" y por 750 € en "Bienes de inversión": quien sumase la columna
 * "Deducible" se pasaba 2.250 €.
 */
export function libroGastos(data: FiscalArrays, filtro: FiltroPeriodo): Libro {
  const prorrata = prorrataEfectiva(data.config);
  const rows = data.gastos
    .filter((g) => enPeriodo(g.fecha, filtro) && !g.esBienInversion)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((g, idx) => [
      idx + 1,
      g.fecha.slice(0, 10),
      g.proveedorNombre ?? "",
      g.proveedorNif ?? "",
      CATEGORIA_LABEL[g.categoria],
      g.base,
      g.tipoIva,
      g.cuotaIva,
      g.porcentajeAfectacion,
      deducibleIrpf(g, data.config.situacionIva, prorrata),
      g.total,
    ]);
  return {
    nombre: "Libro de gastos",
    headers: [
      "Nº asiento",
      "Fecha",
      "Proveedor",
      "NIF",
      "Categoría",
      "Base",
      "% IVA",
      "Cuota IVA",
      "% afectación",
      "Deducible",
      "Total",
    ],
    rows,
  };
}

export function libroBienesInversion(
  data: FiscalArrays,
  filtro: FiltroPeriodo,
): Libro {
  const rows = data.bienes
    .filter((b) => {
      const adq = anioDeFecha(b.fechaAdquisicion);
      const dentroVida =
        adq <= filtro.ejercicio &&
        (b.aniosAmortizacion == null ||
          filtro.ejercicio <= adq + b.aniosAmortizacion - 1);
      return dentroVida;
    })
    .sort((a, b) => a.fechaAdquisicion.localeCompare(b.fechaAdquisicion))
    .map((b) => [
      b.descripcion,
      b.fechaAdquisicion.slice(0, 10),
      b.valorAdquisicion,
      b.porcentajeAmortizacion,
      b.aniosAmortizacion ?? "",
      // Prorrateada por días desde la compra: el año de adquisición no se
      // amortiza entero.
      amortizacionEjercicio(b, filtro.ejercicio),
    ]);
  return {
    nombre: "Libro de bienes de inversión",
    headers: [
      "Descripción",
      "Fecha adquisición",
      "Valor",
      "% amortización",
      "Años",
      "Amortización del ejercicio",
    ],
    rows,
  };
}

export function construirLibros(
  data: FiscalArrays,
  filtro: FiltroPeriodo,
  params: ParamsFiscales,
): Libro[] {
  return [
    libroIngresos(data, filtro, params),
    libroGastos(data, filtro),
    libroBienesInversion(data, filtro),
  ];
}
