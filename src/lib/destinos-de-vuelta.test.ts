import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Todo destino que se pida a `/auth/confirm` tiene que estar permitido.
 *
 * `safeNext` valida el `?next=` contra una lista blanca porque sin ella había
 * redirección abierta. Pero el fallo silencioso es el contrario: si el código
 * **pide** un destino que la lista no contempla, `safeNext` devuelve null,
 * nadie se entera y el usuario acaba en la home de su rol.
 *
 * Pasó con el alta profesional (sep-2026). El correo de confirmación volvía a
 * `/auth/confirm?next=/registro`, `/registro` no estaba en la lista y el
 * profesional recién registrado aterrizaba en `/app` —su rol nace como
 * paciente— en lugar de en el paso de «tu consulta». Sin ningún error: el
 * alta simplemente parecía no haber servido para nada.
 *
 * La regla se comprueba sola: se leen los destinos que construye el código y
 * se contrastan con la lista que hay hoy en la ruta. Añadir un `next=` nuevo
 * sin añadirlo a la lista rompe esta prueba.
 */

const src = fileURLToPath(new URL("..", import.meta.url));
const rutaConfirm = join(src, "app", "auth", "confirm", "route.ts");

/** La lista blanca tal y como está escrita en la ruta, sin copiarla aquí. */
function listaPermitida(): string[] {
  const texto = readFileSync(rutaConfirm, "utf8");
  const m = /const ALLOW = (\[[^\]]*\])/.exec(texto);
  if (!m) throw new Error("No se encuentra la lista ALLOW en auth/confirm/route.ts");
  return JSON.parse(m[1]!.replace(/'/g, '"')) as string[];
}

/** El mismo criterio que aplica `safeNext`, no una aproximación. */
function permitido(destino: string, lista: string[]): boolean {
  return lista.some((p) => destino === p || destino.startsWith(p));
}

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (/\.tsx?$/.test(entrada) && !entrada.includes(".test.")) salida.push(ruta);
  }
  return salida;
}

/**
 * Del argumento de `encodeURIComponent(...)` a los destinos que puede valer.
 *
 * Tres formas en el código: literal (`"/registro"`), plantilla con parte fija
 * (`` `/onboarding/${token}` ``, de la que solo importa el prefijo) y variable,
 * que se resuelve buscando su asignación en el mismo fichero.
 */
function destinosDe(argumento: string, texto: string): string[] {
  const literal = /^["'`](\/[^"'`$]*)/.exec(argumento.trim());
  if (literal) return [literal[1]!];

  const nombre = /^\w+$/.exec(argumento.trim());
  if (!nombre) return [];
  const asignacion = new RegExp(`(?:const|let|var)\\s+${argumento.trim()}\\s*=([^;]*);`).exec(texto);
  if (!asignacion) return [];
  return [...asignacion[1]!.matchAll(/["'`](\/[^"'`$]*)/g)].map((m) => m[1]!);
}

function destinosPedidos(): { fichero: string; destino: string }[] {
  const salida: { fichero: string; destino: string }[] = [];
  for (const fichero of ficheros(src)) {
    if (fichero === rutaConfirm) continue;
    const texto = readFileSync(fichero, "utf8");
    for (const m of texto.matchAll(/next=\$\{encodeURIComponent\(([\s\S]*?)\)\}/g)) {
      for (const destino of destinosDe(m[1]!, texto)) {
        salida.push({ fichero: fichero.slice(src.length), destino });
      }
    }
  }
  return salida;
}

describe("destinos de vuelta de /auth/confirm", () => {
  const lista = listaPermitida();
  const pedidos = destinosPedidos();

  it("se encuentran los destinos que construye el código", () => {
    // Si un refactor cambia la forma de construir el `next`, el análisis deja
    // de ver nada y la prueba pasaría vacía. Esto lo impide.
    expect(pedidos.length).toBeGreaterThanOrEqual(3);
  });

  it("todos están en la lista blanca de safeNext", () => {
    const fallos = pedidos
      .filter(({ destino }) => !permitido(destino, lista))
      .map(
        ({ fichero, destino }) =>
          `${fichero} pide volver a «${destino}», que safeNext descarta. ` +
          `El usuario acabará en la home de su rol sin ningún error visible.`,
      );

    expect(fallos).toEqual([]);
  });

  it("ampliar la lista no ha quitado las guardas contra la redirección abierta", () => {
    // Lo que impide el salto a otro dominio no es la lista, son las tres
    // comprobaciones previas de `safeNext`. Ampliar la lista es rutinario;
    // borrar una de estas líneas al hacerlo reabriría el agujero de agosto.
    const texto = readFileSync(rutaConfirm, "utf8");
    expect(texto).toMatch(/!raw\.startsWith\("\/"\)/);
    expect(texto).toMatch(/raw\.startsWith\("\/\/"\)/);
    expect(texto).toMatch(/raw\.includes\("\\\\"\)/);
  });
});
