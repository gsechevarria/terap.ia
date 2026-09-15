/**
 * Evaluación de obligaciones formales (modelos) para el expediente.
 *
 * Tres resultados posibles, y el tercero es tan válido como los otros dos:
 * `obligado`, `no_obligado` y `pendiente`. Sin datos suficientes NO se asume
 * ninguno de los dos primeros — un checklist que marca "no obligado" por
 * silencio es peor que no tener checklist.
 *
 * Funciones puras: reciben los datos, no consultan nada.
 */

import { obtenerReglas, type Territorio } from "./reglas";
import type { Centimos } from "./dinero";

export type Determinacion = "obligado" | "no_obligado" | "pendiente";

export type Obligacion = {
  modelo: string;
  nombre: string;
  determinacion: Determinacion;
  /** Por qué se ha determinado así. Se muestra y se exporta. */
  explicacion: string;
  /** Qué falta, cuando está pendiente. */
  faltan?: string[];
};

export type DatosObligaciones = {
  ejercicio: number;
  territorio: Territorio | null;
  regimen: "estimacion_directa_simplificada" | "estimacion_directa_normal" | null;
  /** Primer ejercicio con actividad. `null` = desconocido. */
  anioAltaActividad: number | null;
  /** Ingresos del ejercicio ANTERIOR. `null` = no constan. */
  ingresosAnioAnteriorCents: Centimos | null;
  /** De esos ingresos, los sometidos a retención. `null` = no constan. */
  ingresosConRetencionAnioAnteriorCents: Centimos | null;
  /** Situación de IVA declarada. `null` = sin declarar. */
  situacionIva: "exenta" | "sujeta" | "mixta" | null;
  /** `null` = sin responder; distinto de `false`. */
  tieneEmpleados: boolean | null;
  tieneColaboradoresConRetencion: boolean | null;
  tieneAlquileresConRetencion: boolean | null;
};

const pendiente = (
  modelo: string,
  nombre: string,
  explicacion: string,
  faltan: string[],
): Obligacion => ({ modelo, nombre, determinacion: "pendiente", explicacion, faltan });

/**
 * Modelo 130 — pago fraccionado de IRPF.
 *
 * La regla del 70 %: en actividades profesionales no hay obligación si en el
 * año natural anterior al menos el 70 % de los ingresos de la actividad
 * estuvieron sometidos a retención (art. 109 RIRPF). El primer año no tiene
 * ejercicio de referencia y la aplicación NO lo resuelve sola.
 */
export function evaluarModelo130(datos: DatosObligaciones): Obligacion {
  const reglas = obtenerReglas(datos.ejercicio, datos.territorio);
  const nombre = "Pago fraccionado de IRPF";

  if (!reglas.soportado) {
    return pendiente("130", nombre, reglas.motivoNoSoportado ?? "Sin reglas verificadas.", [
      "Reglas verificadas para este territorio y ejercicio",
    ]);
  }
  const umbral = reglas.umbralExencion130Pct.valor;
  if (umbral === null) {
    return pendiente("130", nombre, "El umbral de exención no está verificado.", [
      "Umbral de exención del modelo 130",
    ]);
  }

  // Primer año de actividad: sin ejercicio anterior con el que comparar.
  if (datos.anioAltaActividad !== null && datos.anioAltaActividad === datos.ejercicio) {
    return pendiente(
      "130",
      nombre,
      reglas.exencion130PrimerAnio.nota ??
        "Primer ejercicio de actividad: no hay año anterior de referencia.",
      ["Criterio del gestor para el primer año de actividad"],
    );
  }

  const faltan: string[] = [];
  if (datos.anioAltaActividad === null) faltan.push("Fecha de alta en la actividad");
  if (datos.ingresosAnioAnteriorCents === null) {
    faltan.push(`Ingresos de la actividad en ${datos.ejercicio - 1}`);
  }
  if (datos.ingresosConRetencionAnioAnteriorCents === null) {
    faltan.push(`Ingresos con retención en ${datos.ejercicio - 1}`);
  }
  if (faltan.length > 0) {
    return pendiente(
      "130",
      nombre,
      `La exención depende de si en ${datos.ejercicio - 1} al menos el ${umbral} % de los ingresos tuvo retención, y ese dato no consta.`,
      faltan,
    );
  }

  const total = datos.ingresosAnioAnteriorCents ?? 0;
  const conRetencion = datos.ingresosConRetencionAnioAnteriorCents ?? 0;

  // Sin ingresos el año anterior no hay porcentaje que calcular: dividir por
  // cero no es "0 %", es que la regla no puede aplicarse.
  if (total === 0) {
    return pendiente(
      "130",
      nombre,
      `No constan ingresos de actividad en ${datos.ejercicio - 1}, así que la regla del ${umbral} % no puede aplicarse.`,
      [`Ingresos de ${datos.ejercicio - 1}, o confirmación de que no hubo actividad`],
    );
  }

  const porcentaje = (conRetencion * 100) / total;
  if (porcentaje >= umbral) {
    return {
      modelo: "130",
      nombre,
      determinacion: "no_obligado",
      explicacion: `En ${datos.ejercicio - 1} el ${porcentaje.toFixed(1)} % de los ingresos tuvo retención, que alcanza el ${umbral} % del art. 109 RIRPF.`,
    };
  }
  return {
    modelo: "130",
    nombre,
    determinacion: "obligado",
    explicacion: `En ${datos.ejercicio - 1} solo el ${porcentaje.toFixed(1)} % de los ingresos tuvo retención, por debajo del ${umbral} %.`,
  };
}

/** Modelos 303 y 390 — IVA. Depende de la situación declarada por actividad. */
export function evaluarModelosIva(datos: DatosObligaciones): Obligacion[] {
  const nombre = "Autoliquidación de IVA";
  if (datos.situacionIva === null) {
    return [
      pendiente("303", nombre, "No consta la situación de IVA de la actividad.", [
        "Situación de IVA por actividad",
      ]),
    ];
  }
  if (datos.situacionIva === "exenta") {
    return [
      {
        modelo: "303",
        nombre,
        determinacion: "no_obligado",
        explicacion:
          "Toda la actividad se ha declarado exenta. Conviene que el gestor confirme que la exención cubre cada servicio prestado: la exención sanitaria depende de la titulación y de la finalidad asistencial, no del epígrafe.",
      },
    ];
  }
  return [
    {
      modelo: "303",
      nombre,
      determinacion: "obligado",
      explicacion:
        datos.situacionIva === "mixta"
          ? "Actividad mixta: hay operaciones sujetas. El régimen de deducción (prorrata o sectores diferenciados) lo determina el gestor."
          : "Actividad sujeta a IVA.",
    },
  ];
}

/** Modelos 111 y 190 — retenciones a terceros. */
export function evaluarModelo111(datos: DatosObligaciones): Obligacion {
  const nombre = "Retenciones a trabajadores y profesionales";
  const sinResponder =
    datos.tieneEmpleados === null || datos.tieneColaboradoresConRetencion === null;
  if (sinResponder) {
    return pendiente("111", nombre, "No consta si hay empleados o colaboradores con retención.", [
      "¿Hay empleados?",
      "¿Hay colaboradores a los que se practique retención?",
    ]);
  }
  const hay = datos.tieneEmpleados || datos.tieneColaboradoresConRetencion;
  return {
    modelo: "111",
    nombre,
    determinacion: hay ? "obligado" : "no_obligado",
    explicacion: hay
      ? "Hay empleados o colaboradores a los que se practica retención."
      : "No constan empleados ni colaboradores con retención.",
  };
}

/** Modelos 115 y 180 — retenciones por arrendamiento. */
export function evaluarModelo115(datos: DatosObligaciones): Obligacion {
  const nombre = "Retenciones por arrendamiento de inmuebles";
  if (datos.tieneAlquileresConRetencion === null) {
    return pendiente("115", nombre, "No consta si se paga alquiler con retención.", [
      "¿Se paga alquiler de local con retención?",
    ]);
  }
  return {
    modelo: "115",
    nombre,
    determinacion: datos.tieneAlquileresConRetencion ? "obligado" : "no_obligado",
    explicacion: datos.tieneAlquileresConRetencion
      ? "Se declara alquiler sujeto a retención."
      : "No consta alquiler sujeto a retención.",
  };
}

/** Checklist condicional completo. Nada se asigna por defecto a todo el mundo. */
export function evaluarObligaciones(datos: DatosObligaciones): Obligacion[] {
  return [
    evaluarModelo130(datos),
    ...evaluarModelosIva(datos),
    evaluarModelo111(datos),
    evaluarModelo115(datos),
  ];
}
