#!/usr/bin/env node
/**
 * Guardia del bucle autónomo de Claude Code.
 *
 * Se engancha como hook PreToolUse sobre la herramienta Bash (ver
 * `.claude/settings.json`). Recibe por stdin el JSON del evento, decide, y:
 *   - exit 0  → deja pasar el comando.
 *   - exit 2  → lo bloquea y devuelve a Claude el motivo por stderr.
 *
 * Qué protege, y por qué:
 *
 * 1. El esquema remoto de Supabase. `db push`, `db reset --linked`,
 *    `migration repair` y `seed` son irreversibles sobre una base con
 *    histórico clínico y contable. Las ejecuta una persona, nunca el agente.
 * 2. `main` y producción. Un push directo a `main` despliega en Vercel sin
 *    pasar por la CI ni por un preview. El camino es: rama → PR → CI verde →
 *    merge.
 * 3. La puerta de la CI. `gh pr merge` solo pasa si TODOS los checks del PR
 *    están en verde, comprobado aquí contra GitHub y no de palabra.
 * 4. Los secretos. `.env.local` lleva la service_role, que salta la RLS.
 *
 * Falla ABIERTO si no entiende la entrada: la lista `deny` de settings.json es
 * la segunda capa. Un hook roto no debe dejar el repo inutilizable.
 *
 * No es una frontera de seguridad: se esquiva con suficiente ingenio de shell.
 * Es una red que evita el error tonto a las dos de la mañana.
 */

import { execFileSync } from "node:child_process";

const BLOQUEO = 2;

/** Reglas de bloqueo directo. La primera que casa gana. */
const REGLAS = [
  {
    re: /\bsupabase\s+db\s+push\b|\bnpm\s+run\s+db:push\b/,
    motivo:
      "`db push` aplica migraciones al Supabase remoto y no se puede deshacer. " +
      "Escribe el fichero en supabase/migrations/ y para: lo aplica Gabriel, " +
      "siguiendo el orden de CLAUDE.md (verificar-historial → repair → push → verificar-remoto).",
  },
  {
    re: /\bsupabase\s+db\s+reset\b[^\n]*--linked|\bsupabase\s+db\s+reset\b[^\n]*--project-ref/,
    motivo:
      "`db reset --linked` DESTRUYE la base remota. Para reiniciar la local, " +
      "`npx supabase db reset` a secas, con Supabase local levantado.",
  },
  {
    re: /\bsupabase\s+migration\s+repair\b/,
    motivo:
      "`migration repair` reescribe el historial de migraciones del remoto. " +
      "Es una operación de diagnóstico que ejecuta una persona tras mirar " +
      "verificar-historial.sql.",
  },
  {
    re: /\bsupabase\s+link\b/,
    motivo:
      "`supabase link` reapunta el proyecto local a otro remoto. Si crees que " +
      "hace falta, párate y dilo.",
  },
  {
    re: /\bnpm\s+run\s+seed\b|\bnode\s+[^\n]*scripts\/seed\.mjs/,
    motivo:
      "`seed` escribe con la service_role sobre la base real: crea usuarios en " +
      "Auth e inserta pacientes. Nunca desde el agente.",
  },
  {
    re: /\bnpm\s+run\s+gen:types\b/,
    motivo:
      "`gen:types` necesita credenciales remotas. Si una migración nueva rompe " +
      "el tipado, edita database.types.ts a mano y avisa de que hay que " +
      "regenerarlo después de aplicar.",
  },
  {
    re: /--env-file[= ]\.env\.local|\bcat\s+[^\n]*\.env\.local|\btype\s+[^\n]*\.env\.local|\bgrep\b[^\n]*\.env\.local/,
    motivo:
      ".env.local contiene la service_role y las claves VAPID. No se lee ni se " +
      "imprime. Los nombres de las variables están en .env.example.",
  },
  {
    re: /\bnpm\s+audit\s+fix\b/,
    motivo:
      "`npm audit fix` deshace pines deliberados (SheetJS por tarball, next + " +
      "eslint-config-next fijados juntos, overrides de sharp/tar/uuid). " +
      "Las subidas de dependencias entran por los PR de Dependabot.",
  },
  {
    re: /\bvercel\b[^\n]*--prod|\bvercel\s+deploy\b|\bvercel\s+promote\b|\bvercel\s+rollback\b/,
    motivo:
      "El despliegue a producción lo dispara el merge a main, no un comando. " +
      "Si Vercel no estuviera conectado al repo, eso es una decisión de " +
      "configuración, no algo que resolver desde aquí.",
  },
  {
    re: /\bgh\s+pr\s+merge\b[^\n]*--admin/,
    motivo:
      "`--admin` se salta los checks requeridos. La CI es la puerta: si está " +
      "en rojo, se arregla, no se rodea.",
  },
  {
    re: /\bgit\s+push\b[^\n]*(--force\b|--force-with-lease\b|\s-f\b)/,
    motivo:
      "Un push forzado reescribe historia publicada. Si necesitas rehacer una " +
      "rama ya subida, dilo y se decide.",
  },
];

/** Devuelve la rama actual, o null si no se puede averiguar. */
function ramaActual() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Estado de los checks del PR de la rama actual.
 * Devuelve { ok, detalle }. Ante cualquier duda, ok=false: preferimos no
 * mergear a mergear a ciegas.
 */
function checksDelPr() {
  let salida;
  try {
    salida = execFileSync("gh", ["pr", "checks", "--json", "name,state,bucket"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const texto = String(e.stderr || e.stdout || e.message || "").trim();
    return {
      ok: false,
      detalle:
        "No he podido leer el estado de los checks (`gh pr checks`). " +
        (texto ? `GitHub respondió: ${texto}. ` : "") +
        "Sin esa lectura no hay puerta que valga.",
    };
  }

  let checks;
  try {
    checks = JSON.parse(salida);
  } catch {
    return { ok: false, detalle: "La salida de `gh pr checks` no es JSON válido." };
  }
  if (!Array.isArray(checks) || checks.length === 0) {
    return { ok: false, detalle: "El PR no tiene ningún check registrado todavía." };
  }

  const malos = checks.filter((c) => {
    const bucket = String(c.bucket || "").toLowerCase();
    const state = String(c.state || "").toUpperCase();
    if (bucket) return !["pass", "skipping"].includes(bucket);
    return !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(state);
  });

  if (malos.length > 0) {
    const lista = malos
      .map((c) => `  · ${c.name}: ${c.bucket || c.state}`)
      .join("\n");
    return {
      ok: false,
      detalle: `Checks que no están en verde:\n${lista}`,
    };
  }
  return { ok: true, detalle: `${checks.length} checks en verde.` };
}

function bloquear(motivo) {
  process.stderr.write(`⛔ Bloqueado por scripts/guard-agente.mjs\n\n${motivo}\n`);
  process.exit(BLOQUEO);
}

async function main() {
  const crudo = await new Promise((resolve) => {
    let datos = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (datos += c));
    process.stdin.on("end", () => resolve(datos));
    process.stdin.on("error", () => resolve(""));
  });

  let evento;
  try {
    evento = JSON.parse(crudo);
  } catch {
    process.exit(0); // falla abierto: queda la lista deny de settings.json
  }

  if (evento.tool_name !== "Bash") process.exit(0);

  const comando = String(evento.tool_input?.command ?? "");
  if (!comando.trim()) process.exit(0);

  // Una línea, para que los saltos y el relleno no escondan nada.
  const plano = comando.replace(/\s+/g, " ").trim();

  for (const { re, motivo } of REGLAS) {
    if (re.test(plano)) bloquear(motivo);
  }

  const rama = ramaActual();

  if (/\bgit\s+push\b/.test(plano)) {
    if (/(^|\s)(origin\/)?main(\s|$)|:main\b/.test(plano)) {
      bloquear(
        "No se hace push directo a `main`: eso despliega en producción sin " +
          "preview y sin esperar a la CI. Sube la rama y abre un PR."
      );
    }
    if (rama === "main") {
      bloquear(
        "Estás en `main`. Crea una rama desde `origin/main` " +
          "(`git switch -c <tipo>/<asunto> origin/main`) y trabaja ahí."
      );
    }
  }

  if (/\bgit\s+commit\b/.test(plano) && rama === "main") {
    bloquear(
      "No se commitea sobre `main`. `git switch -c <tipo>/<asunto> origin/main` " +
        "y repite: los cambios sin commitear viajan contigo."
    );
  }

  if (/\bgh\s+pr\s+merge\b/.test(plano)) {
    const { ok, detalle } = checksDelPr();
    if (!ok) {
      bloquear(
        `El merge a main despliega en producción y la CI es la puerta.\n\n${detalle}\n\n` +
          "Arregla lo que falle, vuelve a subir y reintenta. Si el PR aún está " +
          "corriendo, espera con `gh pr checks --watch`."
      );
    }
    process.stderr.write(`✓ guard-agente: ${detalle} Merge permitido.\n`);
  }

  process.exit(0);
}

main();
