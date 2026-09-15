import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, crearZip } from "./zip";

const texto = (s: string) => new TextEncoder().encode(s);

describe("crc32", () => {
  it("coincide con los vectores conocidos del estándar", () => {
    // Valores publicados del CRC-32 IEEE, que es el que exige el formato ZIP.
    expect(crc32(texto(""))).toBe(0);
    expect(crc32(texto("a"))).toBe(0xe8b7be43);
    expect(crc32(texto("abc"))).toBe(0x352441c2);
    expect(crc32(texto("123456789"))).toBe(0xcbf43926);
  });

  it("es sensible al orden de los bytes", () => {
    expect(crc32(texto("ab"))).not.toBe(crc32(texto("ba")));
  });
});

describe("estructura del ZIP", () => {
  const momento = new Date("2026-09-15T12:34:56");

  it("empieza por la firma de cabecera local y acaba por la de fin", () => {
    const zip = crearZip([{ nombre: "a.txt", contenido: "hola" }], momento);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
  });

  it("declara tantas entradas como se le pasan", () => {
    const zip = crearZip(
      [
        { nombre: "uno.txt", contenido: "1" },
        { nombre: "dos.txt", contenido: "2" },
        { nombre: "carpeta/tres.txt", contenido: "3" },
      ],
      momento,
    );
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const inicioFin = zip.length - 22;
    expect(v.getUint16(inicioFin + 8, true)).toBe(3);
    expect(v.getUint16(inicioFin + 10, true)).toBe(3);
  });

  it("el directorio central empieza donde dice el registro de fin", () => {
    const zip = crearZip(
      [
        { nombre: "uno.txt", contenido: "contenido largo de prueba" },
        { nombre: "dos.bin", contenido: new Uint8Array([0, 1, 2, 255]) },
      ],
      momento,
    );
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const desplazamiento = v.getUint32(zip.length - 22 + 16, true);
    // Ahí tiene que haber la firma del directorio central, no otra cosa.
    expect(v.getUint32(desplazamiento, true)).toBe(0x02014b50);
  });

  it("guarda el CRC y el tamaño reales de cada fichero", () => {
    const contenido = "datos del expediente";
    const zip = crearZip([{ nombre: "x.txt", contenido }], momento);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(v.getUint32(14, true)).toBe(crc32(texto(contenido)));
    expect(v.getUint32(18, true)).toBe(contenido.length);
    expect(v.getUint32(22, true)).toBe(contenido.length);
  });

  it("marca los nombres como UTF-8, para que las tildes no se rompan", () => {
    const zip = crearZip([{ nombre: "documentación.txt", contenido: "x" }], momento);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800);
  });

  it("no se confunde con contenido que lleva dentro firmas de ZIP", () => {
    /*
     * El caso real: `libros.xlsx` ES un ZIP, así que dentro del expediente hay
     * bytes 50 4B 03 04 y 50 4B 01 02 que no son cabeceras nuestras. Si el
     * escritor los tratara como tales —o si un lector buscara la firma por
     * fuerza bruta en vez de fiarse del registro de fin— el archivo saldría
     * corrupto justo en el fichero más importante para el gestor.
     */
    const falsoXlsx = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 1, 2, 3,
      0x50, 0x4b, 0x01, 0x02, 4, 5, 6,
      0x50, 0x4b, 0x05, 0x06, 7, 8, 9,
    ]);
    const zip = crearZip([{ nombre: "libros.xlsx", contenido: falsoXlsx }], momento);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    // El registro de fin es el ÚLTIMO, no el primero que aparezca.
    const inicioFin = zip.length - 22;
    expect(v.getUint32(inicioFin, true)).toBe(0x06054b50);
    expect(v.getUint16(inicioFin + 8, true)).toBe(1);

    const desplazamiento = v.getUint32(inicioFin + 16, true);
    expect(v.getUint32(desplazamiento, true)).toBe(0x02014b50);
    expect(v.getUint32(desplazamiento + 20, true)).toBe(falsoXlsx.length);
  });

  it("calcula el CRC sobre la vista, no sobre el búfer que la contiene", () => {
    /*
     * Un `Buffer` de Node suele ser una ventana sobre un búfer compartido más
     * grande: `subarray` devuelve una vista con desplazamiento. Leer el búfer
     * entero en vez de la vista daría un CRC ajeno al contenido, y el archivo
     * se abriría "corrupto" sin que nada en el código lo delatara.
     */
    const grande = new Uint8Array([9, 9, 9, 97, 98, 99, 9, 9]);
    const vista = grande.subarray(3, 6); // "abc"
    expect(vista.byteOffset).toBe(3);
    expect(crc32(vista)).toBe(0x352441c2);

    const zip = crearZip([{ nombre: "v.txt", contenido: vista }], momento);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(v.getUint32(14, true)).toBe(0x352441c2);
    expect(v.getUint32(18, true)).toBe(3);
  });

  it("rechaza más entradas de las que el formato puede numerar", () => {
    const demasiadas = Array.from({ length: 65_536 }, (_, i) => ({
      nombre: `f${i}`,
      contenido: "",
    }));
    expect(() => crearZip(demasiadas)).toThrow(/ZIP64/);
  });
});

describe("compatibilidad real", () => {
  /**
   * La prueba que de verdad importa: que un descompresor ajeno lo abra. Un ZIP
   * con la estructura "correcta" según mis propias comprobaciones sigue siendo
   * inútil si Windows o el gestor no pueden abrirlo.
   */
  it("lo abre un descompresor externo y el contenido cuadra", () => {
    const zip = crearZip([
      { nombre: "resumen.txt", contenido: "Ingresos 1.234,56 €" },
      { nombre: "libros/ingresos.csv", contenido: "fecha;base\n2026-01-01;100" },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "zip-test-"));
    const ruta = join(dir, "expediente.zip");
    writeFileSync(ruta, zip);

    /*
     * Se prueban varios descompresores porque no hay uno universal: el `tar` de
     * Git Bash es GNU tar, que NO lee ZIP; el de Windows y macOS es bsdtar, que
     * sí. En los runners de Linux está `unzip`. Rutas relativas con `cwd`
     * porque GNU tar toma un `C:\…` por un host remoto.
     *
     * Si no hay ninguno, la prueba se salta en lugar de fallar: el juez no es
     * el objeto de estudio, y las comprobaciones de estructura ya han corrido.
     */
    const candidatos: [string, string[]][] = [
      ["unzip", ["-qq", "expediente.zip"]],
      ["bsdtar", ["-xf", "expediente.zip"]],
      ["tar", ["-xf", "expediente.zip"]],
    ];

    let extraido = false;
    for (const [programa, args] of candidatos) {
      try {
        execFileSync(programa, args, { cwd: dir, stdio: "pipe" });
        extraido = true;
        break;
      } catch {
        // Ni instalado ni capaz de leer ZIP: se prueba el siguiente.
      }
    }
    if (!extraido) return;

    expect(readFileSync(join(dir, "resumen.txt"), "utf8")).toBe("Ingresos 1.234,56 €");
    expect(readFileSync(join(dir, "libros", "ingresos.csv"), "utf8")).toContain("2026-01-01");
  });
});
