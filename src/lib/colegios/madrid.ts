import type { FilaRegistro, IntegracionColegio } from "./tipos";

/**
 * Colegio Oficial de la Psicología de Madrid.
 *
 * Registro público en `listado-colegiados?q=`, un GET sin estado que el
 * servidor devuelve ya renderizado (Astro). Sin captcha ni `robots.txt`, y sus
 * condiciones de uso no restringen el acceso automatizado (comprobado el
 * 24-sep-2026).
 *
 * Dos cosas de su comportamiento que importan:
 *  · la búsqueda es PARCIAL: `q=8820` devuelve M-08820, M-18820 y M-38820. Por
 *    eso se busca por el número completo y se exige coincidencia exacta.
 *  · el número va con prefijo y cinco cifras: «M-08820».
 *
 * Estructura de cada resultado, dentro de `#listing-results`:
 *   <article> <h3>NOMBRE</h3> <p class="… text-primary">M-08820</p>
 *     … <span>Titulacion academica:</span> <span>Licenciatura</span>
 *     … <span>Situacion:</span> Ejerciente </article>
 */

const BASE = "https://web.copmadrid.org/ciudadania/servicios-al-ciudadano/listado-colegiados";

function texto(fragmento: string): string {
  return fragmento
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function leerMadrid(html: string): FilaRegistro[] {
  // Si no está el contenedor de resultados, la página ha cambiado: se lanza
  // para que el alta pase a revisión manual en vez de leer «no encontrado».
  const inicio = html.indexOf('id="listing-results"');
  if (inicio === -1) throw new Error("El registro de Madrid ha cambiado de formato.");
  const bloque = html.slice(inicio);
  const filas: FilaRegistro[] = [];
  for (const m of bloque.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)) {
    const art = m[1] ?? "";
    const nombre = texto(/<h3\b[^>]*>([\s\S]*?)<\/h3>/.exec(art)?.[1] ?? "");
    const numero = texto(/<p\b[^>]*text-primary[^>]*>([\s\S]*?)<\/p>/.exec(art)?.[1] ?? "");
    const titulacion = texto(
      /Titulacion academica:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i.exec(art)?.[1] ?? "",
    );
    const situacion = texto(/Situacion:\s*<\/span>([\s\S]*?)<\/p>/i.exec(art)?.[1] ?? "");
    if (!nombre || !numero) continue;
    filas.push({
      nombre,
      numero,
      situacion: situacion || null,
      titulacion: titulacion || null,
    });
  }
  return filas;
}

export const MADRID: IntegracionColegio = {
  clave: "cop-madrid",
  nombre: "Colegio Oficial de la Psicología de Madrid",
  paginaPublica: BASE,
  normalizarNumero(escrito) {
    // «M-08820», «m08820», «08820» y «8820» son el mismo. Otra letra de
    // prefijo no es de Madrid.
    const limpio = escrito.trim().toUpperCase().replace(/\s+/g, "");
    const m = /^(?:M-?)?(\d{1,5})$/.exec(limpio);
    if (!m) return null;
    return `M-${m[1]!.padStart(5, "0")}`;
  },
  peticion(numero) {
    return { url: `${BASE}?q=${encodeURIComponent(numero)}` };
  },
  leer: leerMadrid,
  ejerce(situacion) {
    // «Ejerciente» sí; «No ejerciente» no. Se compara la palabra entera para
    // que «No ejerciente» no pase por contener «ejerciente».
    return (situacion ?? "").trim().toLowerCase() === "ejerciente";
  },
};
