import type { FilaRegistro, IntegracionColegio } from "./tipos";

/**
 * Colegio Oficial de Psicología del Principado de Asturias.
 *
 * Directorio público en `directorio_prof_list.php`, un POST de formulario sin
 * estado (sin cookies, token ni captcha) que devuelve HTML ya renderizado. Sin
 * `robots.txt`. Su aviso legal prohíbe reproducir el contenido «con fines
 * comerciales»; consultar un número para verificar un alta no lo reproduce
 * (comprobado el 24-sep-2026).
 *
 * Como en Madrid, la búsqueda es PARCIAL (`O-0000` devuelve cinco): se exige el
 * número exacto. El número va como «O-00001».
 *
 * Estructura de cada resultado:
 *   <div class="profile-blog"> <div class="name-location">
 *     <strong>APELLIDOS, NOMBRE</strong> <span>Número colegiado: O-00001</span>
 *     <div>Categoría académica: …</div> <div …>Ejerce: Si</div>
 */

const LISTADO = "https://www.cop-asturias.org/ventanilla/directorio_prof_list.php";
const PAGINA = "https://www.cop-asturias.org/ventanilla/directorio_prof.php";

function texto(fragmento: string): string {
  return fragmento
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function leerAsturias(html: string): FilaRegistro[] {
  // Sin el contador de resultados, la página no es la esperada: se lanza para
  // que el alta pase a revisión manual en vez de leer «no encontrado».
  if (!/\d+\s+Resultados/.test(html)) {
    throw new Error("El directorio de Asturias ha cambiado de formato.");
  }
  const filas: FilaRegistro[] = [];
  const trozos = html.split(/<div class="profile-blog">/).slice(1);
  for (const trozo of trozos) {
    const nombre = texto(/<strong>([\s\S]*?)<\/strong>/.exec(trozo)?.[1] ?? "");
    const numero = texto(/Número colegiado:\s*([^<]+)</.exec(trozo)?.[1] ?? "");
    const ejerce = texto(/Ejerce:\s*([^<]+)</.exec(trozo)?.[1] ?? "");
    const titulacion = texto(/Categoría académica:\s*([^<]+)</.exec(trozo)?.[1] ?? "");
    if (!nombre || !numero) continue;
    filas.push({
      nombre,
      numero,
      // Se guarda con la palabra del colegio, para que la evidencia diga lo que
      // decía la página.
      situacion: ejerce ? `Ejerce: ${ejerce}` : null,
      titulacion: titulacion || null,
    });
  }
  return filas;
}

export const ASTURIAS: IntegracionColegio = {
  clave: "cop-asturias",
  nombre: "Colegio Oficial de Psicología del Principado de Asturias",
  paginaPublica: PAGINA,
  normalizarNumero(escrito) {
    const limpio = escrito.trim().toUpperCase().replace(/\s+/g, "");
    const m = /^(?:O-?)?(\d{1,5})$/.exec(limpio);
    if (!m) return null;
    return `O-${m[1]!.padStart(5, "0")}`;
  },
  peticion(numero) {
    return {
      url: LISTADO,
      // `var_ejerce=0`: todos. Filtrar aquí por ejercientes escondería al que
      // no ejerce, y entonces se leería «no encontrado» en vez de lo que es.
      cuerpo: { var_numero: numero, f_numpags: "20", f_pagina: "1", var_ejerce: "0" },
    };
  },
  leer: leerAsturias,
  ejerce(situacion) {
    return /^ejerce:\s*s[ií]$/i.test((situacion ?? "").trim());
  },
};
