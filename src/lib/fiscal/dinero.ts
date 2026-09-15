/**
 * Aritmética monetaria en céntimos enteros.
 *
 * El motor anterior trabajaba en euros con `number`, que es coma flotante
 * binaria: `0.1 + 0.2` no es `0.3`, y un libro de ingresos con cuatrocientas
 * líneas acumula el error hasta descuadrar contra la suma de la pantalla. Aquí
 * todo son enteros de céntimo y la división es el único punto donde se decide
 * qué hacer con el resto.
 *
 * POLÍTICA DE REDONDEO — explícita a propósito, porque la hay siempre:
 * redondeo al céntimo más próximo, con el medio céntimo hacia arriba en valor
 * absoluto (`half away from zero`). Es lo que hace la AEAT en sus modelos y lo
 * que evita que −0,005 y +0,005 se redondeen en direcciones distintas.
 */

/** Céntimos. Entero con signo; negativo en abonos y rectificativas. */
export type Centimos = number;

export function esCentimosValido(valor: unknown): valor is Centimos {
  return typeof valor === "number" && Number.isSafeInteger(valor);
}

/** Suma exacta. Sin acumulación de error: son enteros. */
export function sumar(...importes: Centimos[]): Centimos {
  return importes.reduce((total, c) => total + c, 0);
}

/**
 * Aplica un porcentaje entero y redondea al céntimo.
 * `aplicarPorcentaje(12100, 21)` → 2541.
 */
export function aplicarPorcentaje(base: Centimos, porcentaje: number): Centimos {
  return redondearCentimos((base * porcentaje) / 100);
}

/**
 * Extrae la base de un importe que YA incluye el impuesto.
 * `baseDesdeTotal(12100, 21)` → 10000.
 */
export function baseDesdeTotal(total: Centimos, tipoIva: number): Centimos {
  return redondearCentimos(total / (1 + tipoIva / 100));
}

/** Prorratea por días, redondeando al céntimo. */
export function prorratear(
  importe: Centimos,
  numerador: number,
  denominador: number,
): Centimos {
  if (denominador === 0) return 0;
  return redondearCentimos((importe * numerador) / denominador);
}

/** Redondeo al céntimo más próximo, medio hacia arriba en valor absoluto. */
export function redondearCentimos(valor: number): Centimos {
  return Math.sign(valor) * Math.round(Math.abs(valor));
}

/**
 * Formatea para mostrar. Solo en el borde de la interfaz: el cálculo nunca
 * debe partir de una cadena formateada.
 */
export function formatearEuros(centimos: Centimos): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(centimos / 100);
}

/**
 * Convierte a euros como número. Marcado a propósito: solo para pintar o para
 * escribir una celda numérica en una hoja de cálculo, nunca para seguir
 * calculando encima.
 */
export function aEurosParaPresentacion(centimos: Centimos): number {
  return centimos / 100;
}
