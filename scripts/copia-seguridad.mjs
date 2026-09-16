/**
 * Copia de seguridad de los DATOS, sin depender del plan de Supabase.
 *
 * Las copias gestionadas y el point-in-time recovery son funciones de pago.
 * Esto no las sustituye, pero cubre el hueco con lo que sí se puede hacer en
 * cualquier plan: leer todas las tablas con `service_role` por la API y
 * escribirlas a disco, con recuentos y SHA-256 para poder comprobar después
 * que lo guardado es lo que había.
 *
 *   node --env-file=.env.local scripts/copia-seguridad.mjs
 *   node --env-file=.env.local scripts/copia-seguridad.mjs --verificar <carpeta>
 *
 * QUÉ CUBRE
 *   · Todas las tablas del esquema `public` (la lista sale de
 *     `database.types.ts`, así que no se queda obsoleta al añadir tablas).
 *   · El inventario de cuentas de `auth.users` por la Admin API.
 *   · El inventario de objetos de Storage por bucket.
 *
 * QUÉ NO CUBRE, Y HAY QUE SABERLO
 *   · Las CONTRASEÑAS de `auth.users`. La Admin API no las expone. Restaurando
 *     desde aquí, las cuentas hay que recrearlas y la gente vuelve a entrar por
 *     enlace mágico o restableciendo contraseña. Un `pg_dump` sí las trae.
 *   · El ESQUEMA: tablas, funciones, políticas, disparadores. No hace falta —
 *     se reconstruye entero ejecutando las migraciones del repositorio, que son
 *     la fuente de verdad— pero conviene tenerlo presente.
 *   · El CONTENIDO de los ficheros de Storage. Se guarda el inventario (ruta,
 *     tamaño, fecha), no los bytes.
 *
 * Por eso, si puedes ejecutar `supabase db dump`, ESO ES MEJOR y esto sobra.
 * Este script es la red para cuando aquello no está disponible.
 */
import { createClient } from "@supabase/supabase-js";
import { exigirEntorno } from "./lib/entorno.mjs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } =
  exigirEntorno(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const db = createClient(url, key, { auth: { persistSession: false } });

const BUCKETS = ["files", "receipts"];
const PAGINA = 1000;

/** Nombres de tabla, leídos de los tipos generados: una lista menos que mantener. */
async function tablas() {
  const tipos = await readFile("src/lib/database.types.ts", "utf8");
  const bloque = tipos.slice(tipos.indexOf("Tables: {"), tipos.indexOf("Views: {"));
  return [...bloque.matchAll(/^"([a-z0-9_]+)": \{$/gm)].map((m) => m[1]);
}

const sha = (texto) => createHash("sha256").update(texto).digest("hex");

/**
 * Devuelve las filas, o `null` si la tabla todavía no existe.
 *
 * Esto último importa: la copia se hace ANTES de aplicar las migraciones, y en
 * ese momento las tablas nuevas no están. Reventar ahí dejaría sin copia justo
 * en el momento en que hace falta.
 */
async function volcarTabla(nombre) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from(nombre)
      .select("*")
      .range(desde, desde + PAGINA - 1);
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return null;
      throw new Error(`${nombre}: ${error.message}`);
    }
    filas.push(...data);
    if (data.length < PAGINA) break;
  }
  return filas;
}

async function cuentas() {
  const usuarios = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error(`auth.users: ${error.message}`);
    usuarios.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email,
        email_confirmed_at: u.email_confirmed_at,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
      })),
    );
    if (data.users.length < 1000) break;
  }
  return usuarios;
}

async function objetosStorage() {
  const inventario = {};
  for (const bucket of BUCKETS) {
    const { data, error } = await db.storage.from(bucket).list("", { limit: 10000 });
    if (error) {
      inventario[bucket] = { error: error.message };
      continue;
    }
    inventario[bucket] = data.map((o) => ({
      name: o.name,
      size: o.metadata?.size ?? null,
      updated_at: o.updated_at,
    }));
  }
  return inventario;
}

// --- Verificación de una copia ya hecha --------------------------------------
if (process.argv.includes("--verificar")) {
  const carpeta = process.argv[process.argv.indexOf("--verificar") + 1];
  if (!carpeta || !existsSync(carpeta)) {
    console.error("Uso: --verificar <carpeta de la copia>");
    process.exit(1);
  }
  const manifiesto = JSON.parse(await readFile(path.join(carpeta, "manifest.json"), "utf8"));
  let problemas = 0;

  console.log(`\nVerificando ${carpeta}\n`);
  for (const [nombre, meta] of Object.entries(manifiesto.tablas)) {
    const contenido = await readFile(path.join(carpeta, `${nombre}.json`), "utf8");
    const integro = sha(contenido) === meta.sha256;
    const enDisco = JSON.parse(contenido).length;

    // `*` y no `id`: hay tablas cuya clave primaria no se llama así
    // (`organization_access`, `platform_admins`, `notification_preferences`).
    const { count } = await db.from(nombre).select("*", { count: "exact", head: true });
    const enVivo = count ?? 0;

    // Que haya MÁS filas en vivo es normal si la base sigue en uso; que haya
    // MENOS de las copiadas significa que algo se ha borrado desde entonces.
    const ok = integro && enDisco <= enVivo;
    if (!ok) problemas++;
    console.log(
      `  ${ok ? "OK  " : "AVISO"} ${nombre.padEnd(30, ".")} copia ${String(enDisco).padStart(5)} · vivo ${String(enVivo).padStart(5)}${integro ? "" : "  · SHA-256 NO COINCIDE"}`,
    );
  }
  console.log(
    problemas === 0
      ? "\nLa copia está íntegra y no falta nada en la base.\n"
      : `\n${problemas} aviso(s). Revisa antes de fiarte de esta copia.\n`,
  );
  process.exit(problemas === 0 ? 0 : 1);
}

// --- Copia ------------------------------------------------------------------
const sello = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const carpeta = path.join("..", "BACKUPS", `DATOS-${sello}`);
await mkdir(carpeta, { recursive: true });

console.log(`\nEscribiendo la copia en ${carpeta}\n`);

const manifiesto = {
  creada: new Date().toISOString(),
  proyecto: url,
  aviso:
    "Copia de DATOS. No incluye contraseñas de auth.users ni el contenido de Storage. El esquema se reconstruye con las migraciones del repositorio.",
  tablas: {},
};

const ausentes = [];
for (const nombre of await tablas()) {
  const filas = await volcarTabla(nombre);
  if (filas === null) {
    ausentes.push(nombre);
    console.log(`  ${nombre.padEnd(32, ".")}     — aún no existe en esta base`);
    continue;
  }
  const contenido = JSON.stringify(filas, null, 1);
  await writeFile(path.join(carpeta, `${nombre}.json`), contenido, "utf8");
  manifiesto.tablas[nombre] = { filas: filas.length, sha256: sha(contenido) };
  console.log(`  ${nombre.padEnd(32, ".")} ${String(filas.length).padStart(5)} filas`);
}
manifiesto.tablas_ausentes = ausentes;

const usuarios = JSON.stringify(await cuentas(), null, 1);
await writeFile(path.join(carpeta, "auth_users.json"), usuarios, "utf8");
manifiesto.auth_users = { filas: JSON.parse(usuarios).length, sha256: sha(usuarios) };
console.log(`  ${"auth.users (sin contraseñas)".padEnd(32, ".")} ${String(manifiesto.auth_users.filas).padStart(5)} cuentas`);

const storage = JSON.stringify(await objetosStorage(), null, 1);
await writeFile(path.join(carpeta, "storage_inventario.json"), storage, "utf8");
manifiesto.storage = { sha256: sha(storage) };

await writeFile(
  path.join(carpeta, "manifest.json"),
  JSON.stringify(manifiesto, null, 2),
  "utf8",
);

console.log(`\nHecho. ${Object.keys(manifiesto.tablas).length} tablas.`);
console.log(`Comprobar: node --env-file=.env.local scripts/copia-seguridad.mjs --verificar ${carpeta}`);
console.log(
  "\nRECUERDA: esta carpeta contiene datos clínicos. No entra en el repositorio\n" +
    "(../BACKUPS está fuera) y no debe subirse a ningún sitio compartido.\n",
);
