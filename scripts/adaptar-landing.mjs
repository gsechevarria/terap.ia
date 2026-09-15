/**
 * Adapta el CSS de la landing aprobada a este repositorio.
 *
 * La landing se entrega como página estática suelta y aquí convive con una app
 * Next que ya tiene Tailwind cargado en todas las rutas. Eso obliga a aislar en
 * LAS DOS DIRECCIONES, y la segunda es la que no se ve venir:
 *
 *   1. Que la landing no contamine el CRM. Su CSS lleva selectores desnudos
 *      —`html`, `body`, `*`, `a`, `button`, `footer`, `h2`, `em`— que, cargados
 *      en el mismo documento, alcanzarían a cualquier pantalla del panel. Next
 *      conserva el CSS ya cargado al navegar por cliente, así que bastaría con
 *      entrar por la portada e ir a /login para arrastrarlo.
 *
 *   2. Que el CRM no contamine la landing. El preflight de Tailwind pone
 *      `margin:0` en todo, `font-size:inherit` en los encabezados y
 *      `display:block` en las imágenes. El diseño aprobado se dibujó SIN ese
 *      reinicio y deja varios `<p>` con el margen por defecto del navegador:
 *      tal cual, los párrafos del hero se pegarían al titular.
 *
 * La salida se versiona en el repositorio; este script existe para poder
 * rehacerla cuando llegue una entrega nueva, no para ejecutarse en el build.
 *
 *   node scripts/adaptar-landing.mjs [ruta-de-la-carpeta-terap-landing]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGEN = process.argv[2] ?? "terap-landing";
const DESTINO = "src/app/_landing/landing.css";

/** Clase que envuelve toda la landing. Todo el CSS cuelga de ella. */
const RAIZ = "lp-terap";

/** Variables propias de la landing que chocan de nombre con las de la app. */
const VARIABLES = ["ink", "muted", "green", "line", "paper", "font"];

// --- Utilidades de recorrido -------------------------------------------------

/** Índice de la llave que cierra la abierta en `desde`, saltando cadenas. */
function cierreDe(css, desde) {
  let nivel = 0;
  for (let i = desde; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const fin = css.indexOf(c, i + 1);
      i = fin === -1 ? css.length : fin;
      continue;
    }
    if (c === "{") nivel++;
    else if (c === "}" && --nivel === 0) return i;
  }
  return css.length;
}

/** Parte una lista de selectores por comas de primer nivel. */
function porComas(lista) {
  const partes = [];
  let actual = "";
  let profundidad = 0;
  for (const c of lista) {
    if (c === "(" || c === "[") profundidad++;
    else if (c === ")" || c === "]") profundidad--;
    if (c === "," && profundidad === 0) {
      partes.push(actual);
      actual = "";
    } else actual += c;
  }
  if (actual.trim()) partes.push(actual);
  return partes;
}

/**
 * Prefija un selector.
 *
 * `html` se traduce a `:root:has(.lp-terap)` en vez de descartarse: hay dos
 * propiedades —el desplazamiento suave y el margen de las anclas— que solo
 * tienen efecto en el elemento raíz. Con `:has()` se aplican únicamente
 * mientras la landing esté en el documento, así que al navegar al panel dejan
 * de aplicarse solas, sin ningún código que las retire.
 */
function prefijar(selector) {
  const s = selector.trim();
  if (s === "*") return `.${RAIZ} *`;
  if (s === ":root" || s === "body") return `.${RAIZ}`;
  if (s === "html") return `:root:has(.${RAIZ})`;
  if (/^html(?![\w-])/.test(s)) return s.replace(/^html/, `:root:has(.${RAIZ})`);
  if (/^body(?![\w-])/.test(s)) return s.replace(/^body/, `.${RAIZ}`);
  return `.${RAIZ} ${s}`;
}

function transformarBloque(css) {
  let salida = "";
  let i = 0;
  while (i < css.length) {
    const abre = css.indexOf("{", i);
    if (abre === -1) {
      salida += css.slice(i);
      break;
    }
    const cabecera = css.slice(i, abre).trim();
    const cierra = cierreDe(css, abre);
    const cuerpo = css.slice(abre + 1, cierra);
    if (/^@(media|supports|container|layer)/.test(cabecera)) {
      salida += `${cabecera}{${transformarBloque(cuerpo)}}`;
    } else if (cabecera.startsWith("@")) {
      // @keyframes y similares: sus "selectores" son porcentajes, no elementos.
      salida += `${cabecera}{${cuerpo}}`;
    } else {
      salida += `${porComas(cabecera).map(prefijar).join(",")}{${cuerpo}}`;
    }
    i = cierra + 1;
  }
  return salida;
}

// --- Transformación ----------------------------------------------------------

const origen = readFileSync(join(ORIGEN, "public/style.css"), "utf8");
const huella = createHash("sha256").update(origen).digest("hex");

let css = origen;

// 1. Fuera el @import de Google Fonts. Las fuentes pasan por `next/font`, que
//    las auto-hospeda en el build: la CSP del repositorio es `font-src 'self'`
//    y `style-src 'self'`, así que la petición a Google se bloquearía y el
//    diseño caería a la tipografía de respaldo. Auto-hospedarlas conserva el
//    aspecto aprobado Y la decisión de que ninguna IP viaje a un tercero.
css = css.replace(/@import\s+url\([^)]*\);?/g, "");

// 2. Las fuentes se piden por las variables que expone `next/font`.
css = css
  .replace(/'Manrope',\s*sans-serif/g, "var(--fuente-manrope), sans-serif")
  .replace(/font-family:\s*Manrope,\s*sans-serif/g, "font-family:var(--fuente-manrope),sans-serif")
  .replace(/'Lora',\s*Georgia,\s*serif/g, "var(--fuente-lora), Georgia, serif");

// 3. Las variables propias se renombran. `--ink` y `--line` existen también en
//    la app: sin renombrar, cualquier componente del CRM que algún día se
//    colase dentro de la landing heredaría los colores equivocados.
for (const nombre of VARIABLES) {
  css = css.replace(new RegExp(`--${nombre}(?![\\w-])`, "g"), `--lp-${nombre}`);
}

const cuerpo = transformarBloque(css).trim();

// --- Prólogo: devolver a la landing los valores del navegador ----------------

const prologo = `/* ===========================================================================
 * Landing de Terap — CSS adaptado. NO EDITAR A MANO.
 *
 * Generado por \`scripts/adaptar-landing.mjs\` desde la entrega aprobada
 * (versión 3, 15-sep-2026). SHA-256 del \`style.css\` de origen:
 * ${huella}
 *
 * Qué se ha cambiado respecto al original, y nada más:
 *   · Todos los selectores cuelgan de \`.${RAIZ}\`, incluidos los desnudos.
 *   · \`html\` pasa a \`:root:has(.${RAIZ})\`, \`body\` y \`:root\` pasan a \`.${RAIZ}\`.
 *   · Se retira el \`@import\` de Google Fonts; las fuentes llegan
 *     auto-hospedadas por \`next/font\` a través de dos variables.
 *   · Las variables propias se renombran a \`--lp-*\` para no chocar con las
 *     de la app, que comparte los nombres \`--ink\` y \`--line\`.
 *   · Se añaden los dos bloques de abajo. Ni un valor de diseño se ha tocado.
 * ======================================================================== */

/* --- 1. Neutralizar el preflight de Tailwind DENTRO de la landing ----------
 *
 * El diseño aprobado se dibujó contra los valores por defecto del navegador.
 * Tailwind los reinicia en todo el documento, y varias reglas de la landing NO
 * declaran margen —los párrafos del hero, de las secciones, de las preguntas—,
 * así que sin esto quedarían pegados al titular de arriba.
 *
 * Va con \`:where()\` a propósito: aporta especificidad cero, de modo que
 * cualquier regla de la landing gana sin necesidad de \`!important\`. Y va
 * primero, para que el orden también juegue a favor del diseño.
 */
.${RAIZ} :where(*, *::before, *::after) {
  margin: revert;
  padding: revert;
}
.${RAIZ} :where(h1, h2, h3, h4, h5, h6) {
  font-size: revert;
  font-weight: revert;
}
.${RAIZ} :where(img, svg, video) {
  display: revert;
  vertical-align: revert;
}
.${RAIZ} :where(img, video) {
  max-width: revert;
  height: revert;
}
.${RAIZ} :where(ol, ul, menu) {
  list-style: revert;
}
.${RAIZ} :where(button) {
  border-radius: revert;
  background-color: revert;
}

/* --- 2. Anclaje de la landing dentro de la app ----------------------------- */
.${RAIZ} {
  /* El \`body\` de la app es una columna flexible con la franja reglamentaria
     encima. Sin esto, una portada corta dejaría el fondo de la app a la vista
     por debajo. */
  flex: 1;
  /* Tailwind fija \`line-height: 1.5\` en <html>; el original heredaba \`normal\`. */
  line-height: normal;
  /* El menú móvil es \`position:absolute\` y en la entrega original se situaba
     respecto al documento, que empezaba en el borde de la ventana. Aquí encima
     va la franja reglamentaria: sin este \`relative\` el desplegable aparecería
     montado sobre la propia cabecera. */
  position: relative;
}
`;

// --- Epílogo: lo que depende de convivir con la app --------------------------

const epilogo = `
/* Las anclas tienen que despejar la franja reglamentaria además de la cabecera
   de la landing; el original solo contaba con la cabecera. */
:root:has(.${RAIZ}) {
  scroll-padding-top: calc(var(--banner-h, 0px) + 100px);
}
`;

writeFileSync(DESTINO, `${prologo}\n${cuerpo}\n${epilogo}`);
console.log(`${DESTINO}: ${cuerpo.length} bytes de reglas adaptadas.`);
console.log(`origen sha256 ${huella}`);
