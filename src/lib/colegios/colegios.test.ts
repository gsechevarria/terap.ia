import { describe, expect, it } from "vitest";
import { nombresCoinciden, palabrasDelNombre } from "./nombres";
import { MADRID, leerMadrid } from "./madrid";
import { comprobarColegiacion } from "./verificar";
import { ASTURIAS, leerAsturias } from "./asturias";

/*
 * El HTML reproduce la estructura REAL del registro de Madrid (24-sep-2026),
 * con nombres y números inventados: en el repositorio no va el dato de ninguna
 * persona colegiada.
 */
function articulo(nombre: string, numero: string, situacion: string) {
  return `<article class="space-y-3"> <div class="space-y-1"> <h3 class="text-md sm:text-xl font-semibold uppercase">${nombre}</h3> <p class="text-sm font-semibold text-primary">${numero}</p> </div> <div class="space-y-1"> <p class="text-sm"> <span class="font-semibold">Titulacion academica:</span>  <span>Licenciatura</span> </p> <p class="text-sm"> <span class="font-semibold">Situacion:</span> ${situacion} </p> </div>  </article>`;
}
function pagina(...articulos: string[]) {
  return `<html><body><form action="/ciudadania/servicios-al-ciudadano/listado-colegiados" method="get"><input name="q"></form><p class="text-sm">Se han encontrado ${articulos.length} colegiados</p> <div id="listing-results" class="space-y-6"> ${articulos.join(" ")} </div><nav aria-label="Paginación"></nav></body></html>`;
}
function respuesta(html: string, status = 200) {
  return async () => new Response(html, { status });
}

describe("nombres", () => {
  it("ignora tildes, mayúsculas, orden, signos y partículas", () => {
    expect(nombresCoinciden("LUCÍA PRUEBA DE LA FICCIÓN", "Lucia Prueba Ficcion")).toBe(true);
    expect(nombresCoinciden("LUCÍA PRUEBA FICCIÓN", "Prueba-Ficción, Lucía")).toBe(true);
  });
  it("exige las mismas palabras: si falta una, no coincide", () => {
    expect(nombresCoinciden("LUCÍA PRUEBA PRUEBA", "Lucía Prueba")).toBe(false);
    expect(nombresCoinciden("LUCÍA PRUEBA", "Lucía Prueba Otra")).toBe(false);
  });
  it("un nombre vacío no coincide con nada", () => {
    expect(nombresCoinciden("", "")).toBe(false);
    expect(palabrasDelNombre("  de la ")).toEqual([]);
  });
});

describe("registro de Madrid", () => {
  it("normaliza el número a la forma del colegio", () => {
    for (const escrito of ["M-01234", "m01234", "01234", "1234", " M-1234 "]) {
      expect(MADRID.normalizarNumero(escrito), escrito).toBe("M-01234");
    }
    expect(MADRID.normalizarNumero("B-01234")).toBeNull();
    expect(MADRID.normalizarNumero("123456")).toBeNull();
    expect(MADRID.normalizarNumero("")).toBeNull();
  });

  it("lee nombre, número, titulación y situación", () => {
    expect(leerMadrid(pagina(articulo("LUCÍA PRUEBA FICCIÓN", "M-01234", "Ejerciente")))).toEqual([
      { nombre: "LUCÍA PRUEBA FICCIÓN", numero: "M-01234", situacion: "Ejerciente", titulacion: "Licenciatura" },
    ]);
    expect(leerMadrid(pagina())).toEqual([]);
  });

  it("si la página cambia de formato, lanza en vez de leer «no encontrado»", () => {
    expect(() => leerMadrid("<html><body>Mantenimiento</body></html>")).toThrow();
  });

  it("«No ejerciente» no pasa por contener «ejerciente»", () => {
    expect(MADRID.ejerce("Ejerciente")).toBe(true);
    expect(MADRID.ejerce("No ejerciente")).toBe(false);
    expect(MADRID.ejerce(null)).toBe(false);
  });
});

describe("comprobarColegiacion", () => {
  const ahora = new Date("2026-09-24T10:00:00Z");

  it("coincide: número exacto, nombre y ejerciente", async () => {
    const e = await comprobarColegiacion(MADRID, "1234", "Lucía Prueba Ficción", {
      fetch: respuesta(pagina(articulo("LUCÍA PRUEBA FICCIÓN", "M-01234", "Ejerciente"))),
      ahora,
    });
    expect(e.veredicto).toBe("coincide");
    expect(e.numeroConsultado).toBe("M-01234");
    expect(e.url).toContain("q=M-01234");
    expect(e.fila?.nombre).toBe("LUCÍA PRUEBA FICCIÓN");
    expect(e.consultadoEn).toBe("2026-09-24T10:00:00.000Z");
  });

  it("la búsqueda parcial no cuela un número parecido", async () => {
    // El registro devuelve M-11234 al buscar M-01234 si la búsqueda fuera
    // parcial: aunque el nombre coincida, NO es la misma persona.
    const e = await comprobarColegiacion(MADRID, "M-01234", "Lucía Prueba Ficción", {
      fetch: respuesta(pagina(articulo("LUCÍA PRUEBA FICCIÓN", "M-11234", "Ejerciente"))),
      ahora,
    });
    expect(e.veredicto).toBe("no_encontrado");
  });

  it("nombre distinto, no ejerciente y no encontrado se distinguen", async () => {
    const html = pagina(articulo("OTRA PERSONA INVENTADA", "M-01234", "Ejerciente"));
    expect((await comprobarColegiacion(MADRID, "1234", "Lucía Prueba", { fetch: respuesta(html) })).veredicto)
      .toBe("nombre_distinto");
    const baja = pagina(articulo("LUCÍA PRUEBA", "M-01234", "No ejerciente"));
    expect((await comprobarColegiacion(MADRID, "1234", "Lucía Prueba", { fetch: respuesta(baja) })).veredicto)
      .toBe("no_ejerciente");
    expect((await comprobarColegiacion(MADRID, "1234", "Lucía Prueba", { fetch: respuesta(pagina()) })).veredicto)
      .toBe("no_encontrado");
  });

  it("sin integración, número inválido y fallos de red no aprueban", async () => {
    expect((await comprobarColegiacion(null, "1234", "Lucía Prueba")).veredicto).toBe("sin_integracion");
    expect((await comprobarColegiacion(MADRID, "ABC", "Lucía Prueba")).veredicto).toBe("numero_invalido");
    const caida = await comprobarColegiacion(MADRID, "1234", "Lucía Prueba", {
      fetch: respuesta("error", 503),
    });
    expect(caida.veredicto).toBe("error");
    expect(caida.detalle).toContain("503");
    const cambiada = await comprobarColegiacion(MADRID, "1234", "Lucía Prueba", {
      fetch: respuesta("<html>otra cosa</html>"),
    });
    expect(cambiada.veredicto).toBe("error");
    const sinRed = await comprobarColegiacion(MADRID, "1234", "Lucía Prueba", {
      fetch: async () => {
        throw new Error("timeout");
      },
    });
    expect(sinRed.veredicto).toBe("error");
  });
});

describe("directorio de Asturias", () => {
  // Estructura REAL del directorio (24-sep-2026), datos inventados.
  function ficha(nombre: string, numero: string, ejerce: string) {
    return `<div class="col-sm-12"> <div class="profile-blog"> <div class="name-location" style="padding: 0 0 5px 0;">
      <strong>${nombre}</strong>
      <span>Número colegiado: ${numero}</span>
      <div>
      Categoría académica: Licenciado / a      </div>
      <div style="padding: 0 0 5px 0;">
      Ejerce: ${ejerce}      </div> </div> </div> </div>`;
  }
  const paginaAst = (...fichas: string[]) =>
    `<html><div class="barraitem" style="float: left;">${fichas.length} Resultados</div>${fichas.join("")}</html>`;

  it("normaliza el número y consulta por POST de formulario", async () => {
    expect(ASTURIAS.normalizarNumero("1")).toBe("O-00001");
    expect(ASTURIAS.normalizarNumero("o-00001")).toBe("O-00001");
    expect(ASTURIAS.normalizarNumero("M-00001")).toBeNull();

    let metodo = "";
    let cuerpo = "";
    const e = await comprobarColegiacion(ASTURIAS, "1", "Lucía Prueba Ficción", {
      fetch: async (_url, init) => {
        metodo = init?.method ?? "";
        cuerpo = String(init?.body ?? "");
        return new Response(paginaAst(ficha("PRUEBA FICCIÓN, LUCÍA", "O-00001", "Si")));
      },
    });
    expect(metodo).toBe("POST");
    expect(cuerpo).toContain("var_numero=O-00001");
    expect(cuerpo).toContain("var_ejerce=0");
    // «APELLIDOS, NOMBRE» coincide con «Nombre Apellidos».
    expect(e.veredicto).toBe("coincide");
    expect(e.fila?.situacion).toBe("Ejerce: Si");
  });

  it("«Ejerce: No» no aprueba, y la página cambiada tampoco", async () => {
    const no = await comprobarColegiacion(ASTURIAS, "1", "Lucía Prueba Ficción", {
      fetch: respuesta(paginaAst(ficha("PRUEBA FICCIÓN, LUCÍA", "O-00001", "No"))),
    });
    expect(no.veredicto).toBe("no_ejerciente");
    expect(() => leerAsturias("<html>otra cosa</html>")).toThrow();
    expect(leerAsturias(paginaAst())).toEqual([]);
  });
});
