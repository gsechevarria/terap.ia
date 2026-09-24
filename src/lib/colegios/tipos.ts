/** Una fila tal como la devuelve el registro público de un colegio. */
export type FilaRegistro = {
  nombre: string;
  numero: string;
  /** «Ejerciente», «No ejerciente»… tal cual lo escribe el colegio. */
  situacion: string | null;
  titulacion: string | null;
};

/**
 * Integración con el registro público de un colegio.
 *
 * Cada colegio publica su registro a su manera, así que cada uno tiene la suya.
 * Todas cumplen lo mismo: consulta sin estado (sin sesión, sin captcha), por
 * número de colegiado, y leen el nombre y la situación.
 */
export type IntegracionColegio = {
  /** Clave estable, la que se guarda en la evidencia. */
  clave: string;
  /** Nombre que ve el profesional en el selector. */
  nombre: string;
  /** Página pública donde cualquiera puede repetir la consulta. */
  paginaPublica: string;
  /**
   * Número tal cual lo escribe el colegio, o null si lo escrito no puede ser
   * un número de este colegio. Se consulta y se compara SIEMPRE con esta forma.
   */
  normalizarNumero(escrito: string): string | null;
  /**
   * Petición de la consulta por ese número ya normalizado. `cuerpo` va como
   * formulario (`application/x-www-form-urlencoded`) y convierte la petición
   * en POST; sin él es un GET.
   */
  peticion(numero: string): { url: string; cuerpo?: Record<string, string> };
  /** Filas que trae la respuesta. Lanza si el formato no es el esperado. */
  leer(html: string): FilaRegistro[];
  /** Si la situación permite ejercer. */
  ejerce(situacion: string | null): boolean;
};
