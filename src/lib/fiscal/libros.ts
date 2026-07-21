/**
 * Construcción de los LIBROS REGISTRO (AEAT) — orientativos, para que el gestor
 * los importe. Cada libro es { nombre, headers, rows } con importes en euros.
 * NO son facturas ni contabilidad oficial.
 */
import type { FiscalArrays, Trimestre } from "./types";
import { CATEGORIA_LABEL } from "./types";
import type { ParamsFiscales } from "./parametros";
import {
  amortizacionAnual,
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

export function libroGastos(data: FiscalArrays, filtro: FiltroPeriodo): Libro {
  const rows = data.gastos
    .filter((g) => enPeriodo(g.fecha, filtro))
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
      deducibleIrpf(g, data.config.situacionIva),
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
      amortizacionAnual(b),
    ]);
  return {
    nombre: "Libro de bienes de inversión",
    headers: [
      "Descripción",
      "Fecha adquisición",
      "Valor",
      "% amortización",
      "Años",
      "Amortización anual",
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
