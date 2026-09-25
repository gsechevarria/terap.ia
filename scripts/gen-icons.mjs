// Genera los iconos de la PWA y el favicon a partir de la marca de Terap.
//
//   public/icon-192.png, public/icon-512.png  → manifiesto, apple-touch-icon
//   src/app/favicon.ico                       → pestaña del navegador
//
// Los iconos van a sangre (fondo #172e3a hasta el borde, sin esquinas): el
// sistema —Android con el icono `maskable`, iOS en la pantalla de inicio— les
// aplica su propia máscara, y una esquina transparente dibujada aquí quedaría
// como un marco. La «t» ocupa el centro, dentro de la zona segura del 80 %.
//
// La «t» es el mismo trazado vectorial de `public/logo-mark.svg`.
//
// Usa `sharp`, que ya instala Next.js para optimizar imágenes. Ejecutar:
//   npm run gen:icons
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const T =
  "M28.2 13 L34.6 10.6 L34.6 21.6 L43.4 21.6 L43.4 25.6 L34.6 25.6 L34.6 42.6 Q34.6 47.2 38.6 47.2 Q41.2 47.2 43.6 45.2 L44.8 47 Q41 51.6 35.6 51.6 Q28.2 51.6 28.2 43.6 L28.2 25.6 L22.6 25.6 L22.6 23.4 Q26.8 21.2 28.2 13 Z";

/** Icono a sangre: fondo entero y la «t» al 78 %, centrada. */
const aSangre = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#172e3a"/>
  <g transform="translate(32 32) scale(0.78) translate(-33.7 -31.1)"><path fill="#d2ed87" d="${T}"/></g>
</svg>`;

/** Favicon: la marca con su forma, como en la portada. */
const conForma = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path fill="#172e3a" d="M18 3 H46 Q61 3 61 18 V46 Q61 61 46 61 H6 Q3 61 3 58 V18 Q3 3 18 3 Z"/>
  <path fill="#d2ed87" d="${T}"/>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

writeFileSync("public/icon-192.png", await png(aSangre, 192));
writeFileSync("public/icon-512.png", await png(aSangre, 512));

// ICO con PNG dentro (válido desde Windows Vista y en todos los navegadores
// actuales): cabecera de 6 bytes, una entrada de 16 por imagen y los PNG.
const tamanos = [16, 32, 48];
const imagenes = await Promise.all(tamanos.map((s) => png(conForma, s)));
const cabecera = Buffer.alloc(6);
cabecera.writeUInt16LE(0, 0); // reservado
cabecera.writeUInt16LE(1, 2); // tipo: icono
cabecera.writeUInt16LE(imagenes.length, 4);
let desplazamiento = 6 + 16 * imagenes.length;
const entradas = imagenes.map((img, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(tamanos[i], 0); // ancho
  e.writeUInt8(tamanos[i], 1); // alto
  e.writeUInt8(0, 2); // paleta
  e.writeUInt8(0, 3); // reservado
  e.writeUInt16LE(1, 4); // planos
  e.writeUInt16LE(32, 6); // bits por píxel
  e.writeUInt32LE(img.length, 8);
  e.writeUInt32LE(desplazamiento, 12);
  desplazamiento += img.length;
  return e;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([cabecera, ...entradas, ...imagenes]));

console.log("Iconos generados: public/icon-192.png, public/icon-512.png, src/app/favicon.ico");
