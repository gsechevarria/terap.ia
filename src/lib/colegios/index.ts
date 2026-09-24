import { MADRID } from "./madrid";
import { ASTURIAS } from "./asturias";
import type { IntegracionColegio } from "./tipos";

export type { IntegracionColegio, FilaRegistro } from "./tipos";

/**
 * Colegios oficiales de la psicología, para el selector del registro.
 *
 * Solo los que llevan `integracion` se comprueban solos contra su registro
 * público; el resto pasa a revisión de una persona, como hasta ahora. Añadir un
 * colegio es añadir su integración aquí, con sus pruebas.
 */
export type Colegio = {
  clave: string;
  nombre: string;
  integracion: IntegracionColegio | null;
};

export const COLEGIOS: Colegio[] = [
  { clave: "cop-madrid", nombre: MADRID.nombre, integracion: MADRID },
  { clave: "copc", nombre: "Col·legi Oficial de Psicologia de Catalunya", integracion: null },
  { clave: "cop-cv", nombre: "Col·legi Oficial de Psicologia de la Comunitat Valenciana", integracion: null },
  { clave: "copao", nombre: "Colegio Oficial de la Psicología de Andalucía Occidental", integracion: null },
  { clave: "copao-oriental", nombre: "Colegio Oficial de Psicología de Andalucía Oriental", integracion: null },
  { clave: "cop-aragon", nombre: "Colegio Profesional de Psicología de Aragón", integracion: null },
  { clave: "cop-asturias", nombre: ASTURIAS.nombre, integracion: ASTURIAS },
  { clave: "cop-baleares", nombre: "Col·legi Oficial de Psicologia de les Illes Balears", integracion: null },
  { clave: "cop-las-palmas", nombre: "Colegio Oficial de la Psicología de Las Palmas", integracion: null },
  { clave: "cop-tenerife", nombre: "Colegio Oficial de la Psicología de Santa Cruz de Tenerife", integracion: null },
  { clave: "cop-cantabria", nombre: "Colegio Oficial de Psicología de Cantabria", integracion: null },
  { clave: "cop-clm", nombre: "Colegio Oficial de la Psicología de Castilla-La Mancha", integracion: null },
  { clave: "cop-cyl", nombre: "Colegio Oficial de Psicología de Castilla y León", integracion: null },
  { clave: "cop-extremadura", nombre: "Colegio Oficial de Psicología de Extremadura", integracion: null },
  { clave: "cop-galicia", nombre: "Colexio Oficial de Psicoloxía de Galicia", integracion: null },
  { clave: "cop-rioja", nombre: "Colegio Oficial de Psicólogos de La Rioja", integracion: null },
  { clave: "cop-murcia", nombre: "Colegio Oficial de Psicología de la Región de Murcia", integracion: null },
  { clave: "cop-navarra", nombre: "Colegio Oficial de Psicología de Navarra", integracion: null },
  { clave: "cop-bizkaia", nombre: "Colegio Oficial de la Psicología de Bizkaia", integracion: null },
  { clave: "cop-gipuzkoa", nombre: "Colegio Oficial de Psicología de Gipuzkoa", integracion: null },
  { clave: "cop-alava", nombre: "Colegio Oficial de Psicología de Álava", integracion: null },
  { clave: "cop-ceuta", nombre: "Colegio Oficial de Psicología de Ceuta", integracion: null },
  { clave: "cop-melilla", nombre: "Colegio Oficial de Psicología de Melilla", integracion: null },
];

/**
 * El colegio de un alta. Acepta la clave del selector y, para las altas
 * anteriores al selector —texto libre como «COP Madrid»—, el nombre escrito.
 */
export function colegioPorClaveONombre(valor: string | null | undefined): Colegio | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  const porClave = COLEGIOS.find((c) => c.clave === v);
  if (porClave) return porClave;
  const bajo = v.toLowerCase();
  return COLEGIOS.find((c) => c.nombre.toLowerCase() === bajo) ?? null;
}
