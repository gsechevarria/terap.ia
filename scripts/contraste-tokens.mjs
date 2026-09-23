#!/usr/bin/env node
/**
 * Tabla de contraste de los tokens del sistema visual.
 *
 * Lee los valores DIRECTAMENTE de `src/app/globals.css`, así que no puede
 * quedarse desfasada: si alguien cambia un token y baja de AA, esto lo dice.
 *
 *   node scripts/contraste-tokens.mjs            → informe legible, sale 1 si algo falla
 *   node scripts/contraste-tokens.mjs --markdown → la tabla para docs/DESIGN.md
 *
 * Criterio: WCAG 2.1 AA, 4,5:1 para texto normal. Los pares que se comprueban
 * son los que de verdad ocurren en la interfaz, no el producto cartesiano:
 * medir `--ink-3` contra un fondo sobre el que nunca se pinta no demuestra nada.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

/** Extrae `--token: light-dark(#aaa, #bbb)` y `--token: #aaa`. */
function leerTokens(css) {
  const claro = {};
  const oscuro = {};
  const re = /^\s*(--[a-z0-9-]+)\s*:\s*(?:light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)|(#[0-9a-f]{3,8}))\s*;/gim;
  let m;
  while ((m = re.exec(css))) {
    const [, nombre, luz, sombra, plano] = m;
    claro[nombre] = luz ?? plano;
    oscuro[nombre] = sombra ?? plano;
  }
  return { claro, oscuro };
}

const canal = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminancia(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function ratio(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pares que existen en la interfaz. `minimo` es el umbral aplicable:
 * 4.5 para texto, 3.0 para lo que WCAG trata como objeto gráfico.
 */
const PARES = [
  ["--ink-1", "--surface", 4.5, "texto principal sobre la hoja"],
  ["--ink-1", "--canvas", 4.5, "texto principal sobre el lienzo"],
  ["--ink-1", "--surface-muted", 4.5, "texto sobre bloque hundido"],
  ["--ink-1", "--surface-subtle", 4.5, "texto sobre cabecera de tabla"],
  ["--ink-1", "--accent-soft", 4.5, "texto sobre cita confirmada"],
  ["--ink-2", "--surface", 4.5, "cuerpo secundario"],
  ["--ink-2", "--canvas", 4.5, "cuerpo secundario en la barra lateral"],
  ["--ink-2", "--surface-muted", 4.5, "cuerpo secundario hundido"],
  ["--ink-3", "--surface", 4.5, "metadatos y etiquetas de columna"],
  ["--ink-3", "--canvas", 4.5, "metadatos sobre el lienzo"],
  ["--ink-3", "--surface-muted", 4.5, "placeholder del buscador"],
  ["--ink-3", "--surface-subtle", 4.5, "etiquetas de cabecera de tabla"],
  ["--ink-4", "--surface", 4.5, "contadores y pies"],
  ["--ink-4", "--canvas", 4.5, "contadores de la barra lateral"],
  ["--ink-4", "--surface-muted", 4.5, "horas del eje"],
  ["--ink-4", "--surface-subtle", 4.5, "día de la semana no activo"],
  ["--ink-disabled", "--surface", 4.5, "sesión cancelada"],
  ["--ink-disabled", "--surface-muted", 4.5, "sesión realizada"],
  ["--accent", "--surface", 4.5, "enlaces y acciones"],
  ["--accent", "--canvas", 4.5, "navegación activa"],
  ["--accent", "--surface-muted", 4.5, "enlace sobre hundido"],
  ["--accent", "--accent-soft", 4.5, "enlace sobre cita confirmada"],
  ["--danger", "--surface", 4.5, "aviso pendiente en la agenda"],
  ["--danger-ink", "--danger-soft", 4.5, "titular de la franja de seguridad"],
  ["--warning-ink", "--surface", 4.5, "sin confirmar"],
  ["--warning-ink", "--surface-muted", 4.5, "sin confirmar sobre hundido"],
  ["--accent-solid-ink", "--accent-solid", 4.5, "texto de la tarjeta de próxima sesión"],
  ["--accent-on-dark", "--accent-solid", 4.5, "texto secundario de esa tarjeta"],
  ["--banner-ink", "--banner-bg", 4.5, "franja reglamentaria"],
  ["--success", "--success-soft", 4.5, "estado correcto"],
  ["--info", "--info-soft", 4.5, "aviso informativo"],
  ["--danger", "--danger-soft", 4.5, "texto de peligro sobre su fondo"],
  ["--accent", "--surface-subtle", 4.5, "enlace sobre tinte claro"],
];

/**
 * Pares que NO están sujetos al criterio de contraste, con el motivo. Se
 * imprimen igual, porque «no aplica» hay que poder justificarlo.
 */
const EXENTOS = [
  ["--line", "--surface", "separador decorativo: no transmite información"],
  ["--line-soft", "--surface", "línea entre filas: decorativa"],
  ["--line-strong", "--surface", "eje y borde de hueco libre; el hueco lleva siempre su texto al lado"],
  ["--green-3", "--surface", "barra de ocupación; la cifra de horas va SIEMPRE escrita debajo"],
  ["--green-2", "--surface", "semana en curso de la gráfica; el valor va en el title"],
  ["--warning-line", "--surface", "borde de cita sin confirmar; la palabra «sin confirmar» va dentro"],
];

const { claro, oscuro } = leerTokens(CSS);
const markdown = process.argv.includes("--markdown");
let fallos = 0;

function fila(tema, tokens, [texto, fondo, minimo, uso]) {
  const a = tokens[texto];
  const b = tokens[fondo];
  if (!a || !b) {
    fallos++;
    return { texto, fondo, uso, valor: "token no encontrado", ok: false };
  }
  const r = ratio(a, b);
  const ok = r >= minimo;
  if (!ok) fallos++;
  return { tema, texto, fondo, uso, valor: r.toFixed(2), ok, minimo };
}

const filas = [
  ...PARES.map((p) => fila("claro", claro, p)),
  ...PARES.map((p) => fila("oscuro", oscuro, p)),
];

if (markdown) {
  console.log("| Texto | Sobre | Uso | Claro | Oscuro |");
  console.log("|---|---|---|---:|---:|");
  for (const p of PARES) {
    const c = fila("claro", claro, p);
    const o = fila("oscuro", oscuro, p);
    console.log(
      `| \`${p[0]}\` | \`${p[1]}\` | ${p[3]} | ${c.valor}${c.ok ? "" : " ⚠"} | ${o.valor}${o.ok ? "" : " ⚠"} |`,
    );
  }
  console.log("\nExentos del criterio, y por qué:\n");
  for (const [a, b, motivo] of EXENTOS) {
    console.log(`- \`${a}\` sobre \`${b}\` — ${motivo}.`);
  }
} else {
  for (const tema of ["claro", "oscuro"]) {
    console.log(`\n=== TEMA ${tema.toUpperCase()} ===`);
    for (const f of filas.filter((x) => x.tema === tema)) {
      const marca = f.ok ? "ok" : "FALLA";
      console.log(
        `  ${marca.padEnd(6)}${String(f.valor).padStart(6)}  ${f.texto} sobre ${f.fondo}  (${f.uso})`,
      );
    }
  }
  console.log(
    fallos === 0
      ? `\n${filas.length} pares comprobados, todos cumplen AA.`
      : `\n${fallos} pares por debajo de su umbral.`,
  );
}

process.exit(fallos === 0 ? 0 : 1);
