/**
 * Escritor de ZIP mínimo, sin compresión (método `store`).
 *
 * POR QUÉ NO UNA DEPENDENCIA: este repositorio mantiene pines deliberados
 * —SheetJS desde el tarball oficial, `next` con `eslint-config-next`, overrides
 * de `sharp` y `tar`— y corre `npm audit --audit-level=low` en CI. Añadir una
 * librería de compresión para juntar seis ficheros en un contenedor es superficie
 * de auditoría permanente a cambio de cien líneas que no cambian nunca: el
 * formato ZIP de 1989 no se mueve.
 *
 * POR QUÉ SIN COMPRIMIR: lo que va dentro ya está comprimido. Un XLSX es un ZIP,
 * un PDF lleva sus flujos comprimidos, y los CSV de un ejercicio son kilobytes.
 * Comprimir aquí obligaría a implementar deflate, que sí es código delicado.
 *
 * Lo que NO hace, dicho para que nadie lo descubra tarde: no admite ficheros de
 * más de 4 GiB ni más de 65.535 entradas (haría falta ZIP64), y no cifra.
 */

/** Tabla CRC-32 (IEEE 802.3), la que exige el formato. */
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[i] = c >>> 0;
  }
  return tabla;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) {
    c = TABLA_CRC[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en formato MS-DOS, que es lo que el ZIP almacena. */
function fechaDos(d: Date): { hora: number; fecha: number } {
  const año = d.getFullYear();
  // El formato no puede representar nada anterior a 1980.
  const añoDos = Math.max(año - 1980, 0);
  return {
    fecha: (añoDos << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    // Los segundos van en pasos de dos: el campo tiene cinco bits.
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  };
}

export type EntradaZip = {
  /** Ruta dentro del ZIP. Usa `/` como separador, también en Windows. */
  nombre: string;
  contenido: Uint8Array | string;
};

const comoBytes = (v: Uint8Array | string): Uint8Array =>
  typeof v === "string" ? new TextEncoder().encode(v) : v;

/**
 * Construye el ZIP completo en memoria.
 *
 * Un expediente fiscal son unos pocos megabytes; hacerlo por streaming añadiría
 * complejidad sin resolver ningún problema real, y en memoria el contenido es
 * una instantánea consistente: lo que se descarga no cambia a mitad de escritura
 * aunque alguien edite un gasto mientras tanto.
 */
export function crearZip(entradas: EntradaZip[], momento = new Date()): Uint8Array {
  if (entradas.length > 0xffff) {
    throw new Error("Demasiadas entradas para un ZIP sin ZIP64.");
  }
  const { hora, fecha } = fechaDos(momento);

  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const entrada of entradas) {
    const nombre = new TextEncoder().encode(entrada.nombre);
    const datos = comoBytes(entrada.contenido);
    const suma = crc32(datos);

    // --- Cabecera local ---
    const cabecera = new Uint8Array(30 + nombre.length);
    const vc = new DataView(cabecera.buffer);
    vc.setUint32(0, 0x04034b50, true); // firma
    vc.setUint16(4, 20, true); // versión necesaria
    vc.setUint16(6, 0x0800, true); // nombre en UTF-8
    vc.setUint16(8, 0, true); // método: sin comprimir
    vc.setUint16(10, hora, true);
    vc.setUint16(12, fecha, true);
    vc.setUint32(14, suma, true);
    vc.setUint32(18, datos.length, true); // tamaño comprimido
    vc.setUint32(22, datos.length, true); // tamaño original
    vc.setUint16(26, nombre.length, true);
    vc.setUint16(28, 0, true); // sin campo extra
    cabecera.set(nombre, 30);

    locales.push(cabecera, datos);

    // --- Entrada del directorio central ---
    const central = new Uint8Array(46 + nombre.length);
    const vd = new DataView(central.buffer);
    vd.setUint32(0, 0x02014b50, true);
    vd.setUint16(4, 20, true); // versión del creador
    vd.setUint16(6, 20, true); // versión necesaria
    vd.setUint16(8, 0x0800, true);
    vd.setUint16(10, 0, true);
    vd.setUint16(12, hora, true);
    vd.setUint16(14, fecha, true);
    vd.setUint32(16, suma, true);
    vd.setUint32(20, datos.length, true);
    vd.setUint32(24, datos.length, true);
    vd.setUint16(28, nombre.length, true);
    vd.setUint16(30, 0, true); // extra
    vd.setUint16(32, 0, true); // comentario
    vd.setUint16(34, 0, true); // disco inicial
    vd.setUint16(36, 0, true); // atributos internos
    vd.setUint32(38, 0, true); // atributos externos
    vd.setUint32(42, desplazamiento, true); // dónde empieza su cabecera local
    central.set(nombre, 46);
    centrales.push(central);

    desplazamiento += cabecera.length + datos.length;
  }

  const tamañoCentral = centrales.reduce((t, c) => t + c.length, 0);

  // --- Fin del directorio central ---
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(4, 0, true); // número de disco
  vf.setUint16(6, 0, true); // disco del directorio
  vf.setUint16(8, entradas.length, true);
  vf.setUint16(10, entradas.length, true);
  vf.setUint32(12, tamañoCentral, true);
  vf.setUint32(16, desplazamiento, true);
  vf.setUint16(20, 0, true); // sin comentario

  const partes = [...locales, ...centrales, fin];
  const total = partes.reduce((t, p) => t + p.length, 0);
  const salida = new Uint8Array(total);
  let cursor = 0;
  for (const parte of partes) {
    salida.set(parte, cursor);
    cursor += parte.length;
  }
  return salida;
}
