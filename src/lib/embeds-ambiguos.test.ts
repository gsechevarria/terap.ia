import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cuando una tabla tiene DOS claves foráneas al mismo destino, PostgREST no
 * puede adivinar por cuál embeber y rechaza la consulta ENTERA.
 *
 * No es teórico: `patient_assignments` tiene `professional_id` y `created_by`
 * apuntando a `professionals`, y un `.select("… professionals(full_name)")`
 * tumbó la ficha del paciente completa en producción. El error llega en
 * ejecución, no al compilar, así que ni el typecheck ni el build lo ven.
 *
 * Esta prueba deriva las parejas ambiguas de las MIGRACIONES —no de una lista
 * escrita a mano, que se quedaría vieja— y exige que toda consulta que las
 * embeba lleve la pista `destino!columna`.
 */

const raiz = fileURLToPath(new URL("../..", import.meta.url));

/** Ficheros de un árbol, por extensión. */
function ficheros(dir: string, exts: string[]): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada.startsWith(".")) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta, exts));
    else if (exts.some((e) => entrada.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

/**
 * Parejas (tabla → destino) con más de una clave foránea, leídas del SQL.
 *
 * Cubre las dos formas en que el esquema las declara: dentro del `create table`
 * y con un `alter table … add column … references`.
 */
function parejasAmbiguas(): Map<string, Set<string>> {
  const conteo = new Map<string, Map<string, number>>();
  const anota = (tabla: string, destino: string) => {
    if (!conteo.has(tabla)) conteo.set(tabla, new Map());
    const m = conteo.get(tabla)!;
    m.set(destino, (m.get(destino) ?? 0) + 1);
  };

  for (const f of ficheros(join(raiz, "supabase", "migrations"), [".sql"])) {
    const sql = readFileSync(f, "utf8").replace(/--[^\n]*/g, "");

    // create table public.X ( … );
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      for (const r of (m[2] ?? "").matchAll(/references\s+public\.(\w+)\s*\(/gi)) {
        anota(m[1]!, r[1]!);
      }
    }

    // alter table public.X add column … references public.Y ( … )
    for (const m of sql.matchAll(
      /alter\s+table\s+public\.(\w+)([\s\S]*?);/gi,
    )) {
      for (const r of (m[2] ?? "").matchAll(
        /add\s+column[^,;]*?references\s+public\.(\w+)\s*\(/gi,
      )) {
        anota(m[1]!, r[1]!);
      }
    }
  }

  const ambiguas = new Map<string, Set<string>>();
  for (const [tabla, destinos] of conteo) {
    for (const [destino, n] of destinos) {
      if (n > 1) {
        if (!ambiguas.has(tabla)) ambiguas.set(tabla, new Set());
        ambiguas.get(tabla)!.add(destino);
      }
    }
  }
  return ambiguas;
}

/** Cada `.from("x") … .select("…")` del código, emparejados por orden. */
function consultas(): { fichero: string; tabla: string; select: string }[] {
  const salida: { fichero: string; tabla: string; select: string }[] = [];
  for (const f of ficheros(join(raiz, "src"), [".ts", ".tsx"])) {
    if (f.endsWith(".test.ts")) continue;
    const texto = readFileSync(f, "utf8");
    for (const m of texto.matchAll(/\.from\(\s*"(\w+)"\s*\)/g)) {
      const resto = texto.slice(m.index! + m[0].length, m.index! + m[0].length + 1500);
      // Primer `.select("…")` que siga, admitiendo saltos y comentarios en medio.
      const sel = /\.select\(\s*(?:\/\/[^\n]*\n\s*)*"((?:[^"\\]|\\.)*)"/.exec(resto);
      if (sel) salida.push({ fichero: f.slice(raiz.length), tabla: m[1]!, select: sel[1]! });
    }
  }
  return salida;
}

describe("embebidos de PostgREST", () => {
  const ambiguas = parejasAmbiguas();

  it("detecta las tablas con dos claves foráneas al mismo destino", () => {
    // Si esto deja de cumplirse, o el esquema cambió o el analizador se rompió;
    // en ambos casos la prueba de abajo estaría comprobando el vacío.
    expect(ambiguas.get("patient_assignments")).toContain("professionals");
    expect(ambiguas.get("organization_members")).toContain("professionals");
  });

  it("toda consulta que embebe una relación ambigua lleva la pista", () => {
    const fallos: string[] = [];

    for (const { fichero, tabla, select } of consultas()) {
      const destinos = ambiguas.get(tabla);
      if (!destinos) continue;
      for (const destino of destinos) {
        // `destino(` sin `!` delante del paréntesis = embebido sin desambiguar.
        const sinPista = new RegExp(`(^|[,\\s])${destino}\\s*\\(`);
        const conPista = new RegExp(`${destino}\\s*!\\s*\\w+\\s*\\(`);
        if (sinPista.test(select) && !conPista.test(select)) {
          fallos.push(
            `${fichero}: .from("${tabla}") embebe "${destino}" sin pista. ` +
              `Usa "${destino}!<columna>(…)" — hay más de una clave foránea y ` +
              `PostgREST rechaza la consulta entera.`,
          );
        }
      }
    }

    expect(fallos).toEqual([]);
  });
});
