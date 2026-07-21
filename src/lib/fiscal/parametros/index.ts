import { PARAMS_2026, type ParamsFiscales } from "./2026";

/**
 * Selector de parámetros por ejercicio. Al añadir un nuevo año, crea
 * `parametros/<año>.ts` y regístralo aquí. Si no existe el año pedido, cae al
 * más reciente disponible (marcándolo como aproximación).
 */
const PARAMS_POR_ANIO: Record<number, ParamsFiscales> = {
  2026: PARAMS_2026,
};

export const EJERCICIO_MAS_RECIENTE = 2026;

export function getParams(ejercicio: number): ParamsFiscales {
  return PARAMS_POR_ANIO[ejercicio] ?? PARAMS_2026;
}

export function hayParamsExactos(ejercicio: number): boolean {
  return ejercicio in PARAMS_POR_ANIO;
}

export { PARAMS_2026 };
export type { ParamsFiscales };
