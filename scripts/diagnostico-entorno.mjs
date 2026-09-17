/**
 * Por qué Node no lee tu fichero de entorno.
 *
 *   node scripts/diagnostico-entorno.mjs [ruta]
 *
 * NO IMPRIME NINGÚN VALOR. Solo metadatos del fichero y NOMBRES de variable.
 * Esa es la propiedad que lo hace seguro de ejecutar y de pegar en un chat:
 * ni la `service_role` ni las claves VAPID salen de tu máquina.
 *
 * Diagnostica el caso que más muerde en Windows: PowerShell 5.1 escribe en
 * UTF-16LE por defecto (`>`, `Out-File`, `Set-Content` sin `-Encoding utf8`).
 * Node espera UTF-8, así que un fichero UTF-16 se parsea como ruido y se
 * cargan CERO variables, sin un solo error. El fichero se ve perfecto al
 * abrirlo con un editor, que es lo que lo hace tan difícil de ver.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ruta = process.argv[2] ?? path.join(process.cwd(), ".env" + ".local");
const nombre = path.basename(ruta);

console.log(`\n=== Diagnóstico de ${nombre} ===\n`);

if (!existsSync(ruta)) {
  console.log(`  NO EXISTE en ${path.dirname(ruta)}`);
  console.log(`\n  Crea uno copiando .env.example y rellenando los valores.\n`);
  process.exit(1);
}

const bytes = readFileSync(ruta);
console.log(`  Ruta ............. ${ruta}`);
console.log(`  Tamaño ........... ${statSync(ruta).size} bytes`);

// --- Codificación -----------------------------------------------------------
let codificacion = "UTF-8 (sin BOM)";
let problema = null;

if (bytes[0] === 0xff && bytes[1] === 0xfe) {
  codificacion = "UTF-16LE (BOM)";
  problema = "utf16";
} else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
  codificacion = "UTF-16BE (BOM)";
  problema = "utf16";
} else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
  codificacion = "UTF-8 con BOM";
  problema = "bom";
} else {
  // Sin BOM, pero UTF-16 igualmente: en texto ASCII, la mitad de los bytes
  // son NUL. Es la firma inconfundible.
  const nulos = bytes.subarray(0, Math.min(bytes.length, 4096)).filter((b) => b === 0).length;
  if (nulos > Math.min(bytes.length, 4096) * 0.25) {
    codificacion = "UTF-16 (sin BOM)";
    problema = "utf16";
  }
}
console.log(`  Codificación ..... ${codificacion}`);

// --- Saltos de línea --------------------------------------------------------
const texto = bytes.toString("utf8");
console.log(`  Fin de línea ..... ${texto.includes("\r\n") ? "CRLF (Windows)" : "LF"}`);

// --- Qué ve Node de verdad --------------------------------------------------
// La prueba decisiva: se lanza un Node hijo con --env-file y se le pide que
// liste SOLO los nombres que ha conseguido cargar.
let cargadas = [];
let errorCarga = null;
try {
  const salida = execFileSync(
    process.execPath,
    [
      "--env-file=" + ruta,
      "-e",
      "console.log(Object.keys(process.env).filter(k=>/^(NEXT_PUBLIC_|SUPABASE_|VAPID_|CRON_|RESEND_|EMAIL_|SEED_|DEMO_|TZ$)/.test(k)).sort().join('\\n'))",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  cargadas = salida.split("\n").map((s) => s.trim()).filter(Boolean);
} catch (e) {
  errorCarga = (e.stderr || e.message || "").split("\n")[0];
}

console.log("");
if (errorCarga) {
  console.log(`  Node NO pudo abrir el fichero:`);
  console.log(`    ${errorCarga}`);
} else if (cargadas.length === 0) {
  console.log(`  Node carga ....... 0 variables  <-- AQUÍ ESTÁ EL PROBLEMA`);
} else {
  console.log(`  Node carga ....... ${cargadas.length} variables:`);
  for (const k of cargadas) console.log(`      · ${k}`);
}

// --- Análisis línea a línea -------------------------------------------------
// Solo se imprimen NÚMERO DE LÍNEA, NOMBRE de variable y veredicto. El valor
// no se toca ni para medirlo.
const lineas = texto.split(/\r?\n/);
const hallazgos = [];
let comillaAbierta = null;

lineas.forEach((linea, i) => {
  const n = i + 1;
  const limpia = linea.trim();

  if (comillaAbierta !== null) {
    // Seguimos dentro de un valor multilínea abierto más arriba.
    if (linea.includes(comillaAbierta)) comillaAbierta = null;
    return;
  }
  if (limpia === "" || limpia.startsWith("#")) return;

  if (/^export\s+/i.test(limpia)) {
    const nombreVar = limpia.replace(/^export\s+/i, "").split("=")[0].trim();
    hallazgos.push({ n, nombreVar, mal: "lleva `export` delante (Node no lo admite)" });
    return;
  }
  if (!limpia.includes("=")) {
    hallazgos.push({ n, nombreVar: "—", mal: "no tiene `=`" });
    return;
  }

  const [izq, ...resto] = limpia.split("=");
  const valor = resto.join("=");
  const nombreVar = izq.trim();

  if (izq !== nombreVar) {
    hallazgos.push({ n, nombreVar, mal: "hay espacios antes del `=`" });
  } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombreVar)) {
    hallazgos.push({ n, nombreVar, mal: "el nombre tiene caracteres no válidos" });
  }

  // Comilla abierta y no cerrada en la misma línea: se traga lo que venga.
  const v = valor.trim();
  for (const c of ['"', "'"]) {
    if (v.startsWith(c) && !v.endsWith(c)) {
      comillaAbierta = c;
      hallazgos.push({ n, nombreVar, mal: `abre ${c} y no lo cierra: engulle las líneas siguientes` });
    }
  }
});

const declaradas = lineas
  .map((l, i) => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l);
    return m ? { n: i + 1, nombreVar: m[1], largo: l.length } : null;
  })
  .filter(Boolean);

console.log(`  Líneas ........... ${lineas.length}`);
console.log(`  Con forma CLAVE= . ${declaradas.length}`);

if (declaradas.length > 0) {
  console.log(`\n  Nombres declarados (sin valores):`);
  for (const d of declaradas) {
    console.log(`    línea ${String(d.n).padStart(3)} · ${d.nombreVar.padEnd(32)} (línea de ${d.largo} caracteres)`);
  }
}

// Una línea larguísima sin `=` suele ser todo el fichero pegado de una vez.
const sospechosas = lineas
  .map((l, i) => ({ n: i + 1, largo: l.trim().length, tiene: l.includes("=") }))
  .filter((l) => l.largo > 120 && !l.tiene);
if (sospechosas.length > 0) {
  console.log(`\n  Líneas largas SIN \`=\` (¿texto pegado o JSON?):`);
  for (const s of sospechosas) console.log(`    línea ${String(s.n).padStart(3)} · ${s.largo} caracteres`);
}

if (hallazgos.length > 0) {
  console.log(`\n  Líneas problemáticas:`);
  for (const h of hallazgos) {
    console.log(`    línea ${String(h.n).padStart(3)} · ${h.nombreVar.padEnd(30)} ${h.mal}`);
  }
}

// --- Veredicto --------------------------------------------------------------
console.log("\n--- Qué hacer ---\n");

if (problema === "utf16") {
  console.log("  El fichero está en UTF-16. Node solo entiende UTF-8, así que lo");
  console.log("  lee como ruido y no carga nada. Pasa cuando se genera desde");
  console.log("  PowerShell 5.1 con `>`, `Out-File` o `Set-Content` sin indicar");
  console.log("  la codificación. Al abrirlo con un editor se ve perfecto.\n");
  console.log("  Conviértelo sin tocar el contenido (PowerShell):\n");
  console.log(`    $c = Get-Content -Raw "${nombre}"`);
  console.log(`    [IO.File]::WriteAllText((Resolve-Path "${nombre}"), $c, (New-Object Text.UTF8Encoding $false))\n`);
  console.log("  Y vuelve a lanzar este diagnóstico para confirmarlo.\n");
} else if (problema === "bom") {
  console.log("  El fichero es UTF-8 pero lleva BOM, y el BOM se pega al nombre de");
  console.log("  la primera variable: esa se pierde y las demás cargan bien.");
  console.log("  Vuelve a guardarlo como 'UTF-8 sin BOM'.\n");
} else if (cargadas.length === 0 && !errorCarga) {
  console.log("  La codificación es correcta pero Node no carga nada, así que el");
  console.log("  contenido no tiene la forma CLAVE=valor, o una línea anterior");
  console.log("  rompe el parseo (comilla sin cerrar). Revisa que cada línea sea");
  console.log("  `NOMBRE=valor`, sin `export` delante y sin espacios alrededor");
  console.log("  del `=`. Los valores con espacios o `<>` van entre comillas.\n");
} else {
  const faltan = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (v) => !cargadas.includes(v),
  );
  if (faltan.length === 0) {
    console.log("  El fichero se lee bien y están las dos variables que hacen");
    console.log("  falta. Si un script sigue fallando, el problema es otro.\n");
  } else {
    console.log("  El fichero se lee bien, pero faltan estas variables:\n");
    for (const v of faltan) console.log(`    · ${v}`);
    console.log("\n  Los nombres exactos están en .env.example.\n");
  }
}
