import { nombresCoinciden } from "./nombres";
import type { FilaRegistro, IntegracionColegio } from "./tipos";

/**
 * Resultado de consultar un registro público de colegiados.
 *
 * Solo `coincide` aprueba el alta. Todo lo demás la deja pendiente de una
 * persona, con el motivo escrito — incluido `error`: si la web del colegio no
 * responde o ha cambiado, no se bloquea a nadie ni se aprueba a nadie.
 */
export type Veredicto =
  | "coincide"
  | "no_encontrado"
  | "nombre_distinto"
  | "no_ejerciente"
  | "numero_invalido"
  | "sin_integracion"
  | "error";

/** Lo que se guarda para poder explicar después por qué se aprobó o no. */
export type Evidencia = {
  veredicto: Veredicto;
  /** Integración usada, o null si el colegio no tiene. */
  integracion: string | null;
  numeroConsultado: string | null;
  /**
   * Dónde repetir la consulta. En los registros que se consultan por GET es la
   * URL exacta; en los de POST, la página pública del buscador.
   */
  url: string | null;
  consultadoEn: string;
  /** La fila del registro con ese número exacto, si la hubo. */
  fila: FilaRegistro | null;
  /** Nombre que declaró el profesional, contra el que se comparó. */
  nombreDeclarado: string;
  detalle: string;
};

export const MOTIVO: Record<Veredicto, string> = {
  coincide: "Número, nombre y situación coinciden con el registro del colegio.",
  no_encontrado: "Ese número no figura en el registro del colegio.",
  nombre_distinto: "El número existe, pero el nombre del registro no coincide con el declarado.",
  no_ejerciente: "El número existe, pero no figura como ejerciente.",
  numero_invalido: "El número no tiene el formato de ese colegio.",
  sin_integracion: "Este colegio no tiene comprobación automática: lo revisa una persona.",
  error: "No se pudo consultar el registro del colegio: lo revisa una persona.",
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export async function comprobarColegiacion(
  integracion: IntegracionColegio | null,
  numeroEscrito: string,
  nombreDeclarado: string,
  opciones: { fetch?: Fetch; ahora?: Date; timeoutMs?: number } = {},
): Promise<Evidencia> {
  const consultadoEn = (opciones.ahora ?? new Date()).toISOString();
  const base = {
    integracion: integracion?.clave ?? null,
    consultadoEn,
    nombreDeclarado,
  };
  const fin = (
    veredicto: Veredicto,
    resto: Partial<Pick<Evidencia, "numeroConsultado" | "url" | "fila" | "detalle">> = {},
  ): Evidencia => ({
    veredicto,
    numeroConsultado: null,
    url: null,
    fila: null,
    detalle: MOTIVO[veredicto],
    ...base,
    ...resto,
  });

  if (!integracion) return fin("sin_integracion");

  const numero = integracion.normalizarNumero(numeroEscrito);
  if (!numero) return fin("numero_invalido");
  const peticion = integracion.peticion(numero);
  const url = peticion.cuerpo ? integracion.paginaPublica : peticion.url;

  let filas: FilaRegistro[];
  try {
    const res = await (opciones.fetch ?? fetch)(peticion.url, {
      method: peticion.cuerpo ? "POST" : "GET",
      headers: {
        // Se identifica: es una consulta legítima a un registro público, no
        // un navegador disfrazado.
        "User-Agent": "Terap (verificacion de colegiacion; +https://terap.vercel.app)",
        Accept: "text/html",
        ...(peticion.cuerpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: peticion.cuerpo ? new URLSearchParams(peticion.cuerpo).toString() : undefined,
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 8000),
      cache: "no-store",
    });
    if (!res.ok) return fin("error", { numeroConsultado: numero, url, detalle: `${MOTIVO.error} (HTTP ${res.status})` });
    filas = integracion.leer(await res.text());
  } catch (e) {
    const causa = e instanceof Error ? e.message : String(e);
    return fin("error", { numeroConsultado: numero, url, detalle: `${MOTIVO.error} (${causa})` });
  }

  // La búsqueda de los registros suele ser parcial: se exige el número exacto.
  const fila = filas.find((f) => integracion.normalizarNumero(f.numero) === numero) ?? null;
  if (!fila) return fin("no_encontrado", { numeroConsultado: numero, url });
  if (!nombresCoinciden(fila.nombre, nombreDeclarado)) {
    return fin("nombre_distinto", { numeroConsultado: numero, url, fila });
  }
  if (!integracion.ejerce(fila.situacion)) {
    return fin("no_ejerciente", { numeroConsultado: numero, url, fila });
  }
  return fin("coincide", { numeroConsultado: numero, url, fila });
}
