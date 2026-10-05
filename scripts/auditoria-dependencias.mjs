#!/usr/bin/env node
/*
 * `npm audit` con excepciones explícitas, una por aviso.
 *
 * npm no sabe ignorar un aviso concreto: o se baja el umbral, o se excluyen
 * las dependencias de desarrollo enteras, y las dos cosas dejan pasar avisos
 * nuevos sin que nadie se entere. Este script tolera SOLO los identificadores
 * de la lista de abajo; cualquier otro aviso a partir del umbral hace fallar
 * la ejecución, igual que `npm audit --audit-level=<umbral>`.
 *
 * Un paquete se perdona únicamente si TODO lo que lo hace vulnerable es una
 * excepción: un aviso de la lista, u otro paquete que a su vez solo arrastra
 * avisos de la lista. Si un paquete arrastra además un aviso nuevo, falla.
 *
 * Además falla si una excepción ha pasado su fecha de revisión, y avisa (sin
 * fallar) si una excepción ya no aparece en la auditoría y se puede borrar.
 *
 * Uso: node scripts/auditoria-dependencias.mjs [--audit-level=low|moderate|high|critical]
 * Documentación de cada excepción: docs/DEPENDENCIAS.md.
 */
import { execSync } from "node:child_process";

const EXCEPCIONES = [
  {
    id: "GHSA-vfj7-8cjw-p6xm",
    paquete: "braces",
    motivo:
      "DoS por patrones anidados. Ninguna versión publicada lo corrige (3.0.3 es la última). " +
      "Solo llega por eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch: " +
      "herramienta de desarrollo, no viaja al build de producción y solo procesa patrones del propio repositorio.",
    revisar: "2026-11-05",
  },
];

const NIVELES = ["info", "low", "moderate", "high", "critical"];
const arg = process.argv.find((a) => a.startsWith("--audit-level="));
const umbral = arg ? arg.split("=")[1] : "low";
if (!NIVELES.includes(umbral)) {
  console.error(`Nivel desconocido: ${umbral}`);
  process.exit(2);
}

let salida;
try {
  // Cadena fija, sin nada interpolado: así funciona igual con npm.cmd en Windows.
  salida = execSync("npm audit --json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  // npm audit sale con código 1 cuando hay avisos; el JSON viene igual.
  salida = e.stdout;
  if (!salida) {
    console.error("npm audit no devolvió nada:", e.message);
    process.exit(2);
  }
}

const informe = JSON.parse(salida);
if (informe.error) {
  console.error("npm audit falló:", informe.error.summary ?? informe.error);
  process.exit(2);
}
const vulns = informe.vulnerabilities ?? {};
const idsExcepcion = new Set(EXCEPCIONES.map((e) => e.id));
const idDe = (url) => String(url ?? "").split("/").pop();

/** ¿Todo lo que hace vulnerable a `nombre` es una excepción? */
const memo = new Map();
function perdonado(nombre, pila = new Set()) {
  if (memo.has(nombre)) return memo.get(nombre);
  if (pila.has(nombre)) return true; // ciclo: lo decide el resto de la cadena
  pila.add(nombre);
  const v = vulns[nombre];
  const ok =
    !!v &&
    v.via.every((via) =>
      typeof via === "string" ? perdonado(via, pila) : idsExcepcion.has(idDe(via.url)),
    );
  pila.delete(nombre);
  memo.set(nombre, ok);
  return ok;
}

const minimo = NIVELES.indexOf(umbral);
const fallos = [];
const tolerados = [];
for (const [nombre, v] of Object.entries(vulns)) {
  if (NIVELES.indexOf(v.severity) < minimo) continue;
  (perdonado(nombre) ? tolerados : fallos).push(`${nombre} (${v.severity})`);
}

const vistos = new Set(
  Object.values(vulns).flatMap((v) =>
    v.via.filter((x) => typeof x !== "string").map((x) => idDe(x.url)),
  ),
);
const hoy = new Date().toISOString().slice(0, 10);
const caducadas = EXCEPCIONES.filter((e) => vistos.has(e.id) && e.revisar < hoy);
for (const e of EXCEPCIONES.filter((e) => !vistos.has(e.id))) {
  console.warn(`Aviso: la excepción ${e.id} (${e.paquete}) ya no hace falta; bórrala.`);
}

if (tolerados.length) {
  console.log(`Tolerados por excepción documentada: ${tolerados.join(", ")}`);
}
if (caducadas.length) {
  for (const e of caducadas) {
    console.error(`Excepción caducada el ${e.revisar}: ${e.id} (${e.paquete}). Revísala en docs/DEPENDENCIAS.md.`);
  }
}
if (fallos.length) {
  console.error(`Avisos sin excepción (umbral ${umbral}): ${fallos.join(", ")}`);
  console.error("Detalle: npm audit");
}
if (fallos.length || caducadas.length) process.exit(1);
console.log(`OK: ningún aviso sin excepción a partir de «${umbral}».`);
