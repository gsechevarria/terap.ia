/**
 * Alta del primer administrador de plataforma.
 *
 * `platform_admins` nace VACÍA y no se puede escribir desde la aplicación: no
 * tiene ni una política de RLS y no se le concede ningún permiso de API. La
 * única vía es esta, con `service_role`, fuera de banda y a mano.
 *
 *   node --env-file=.env.local scripts/alta-admin-plataforma.mjs correo@dominio
 *
 * Por qué así y no un "primer usuario es admin" o una semilla en la migración:
 * cualquiera de esas dos convierte un despliegue en una escalada de privilegios
 * —el que llegue primero, o el que lea el repositorio—. Aquí hace falta la
 * clave secreta del proyecto y decir el correo en voz alta.
 *
 * Para RETIRAR a alguien: `--retirar correo@dominio`.
 * Para LISTAR los administradores actuales: `--listar`.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const listar = args.includes("--listar");
const retirar = args.includes("--retirar");
const correo = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

async function buscarUsuario(email) {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
}

if (listar) {
  const { data, error } = await db.from("platform_admins").select("user_id, note, created_at");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    console.log("No hay ningún administrador de plataforma dado de alta.");
    process.exit(0);
  }
  for (const a of data) {
    const { data: u } = await db.auth.admin.getUserById(a.user_id);
    console.log(`  ${u?.user?.email ?? a.user_id}  ·  ${a.created_at}  ·  ${a.note ?? ""}`);
  }
  process.exit(0);
}

if (!correo) {
  console.error("Uso: node scripts/alta-admin-plataforma.mjs <correo> [--retirar]");
  console.error("     node scripts/alta-admin-plataforma.mjs --listar");
  process.exit(1);
}

// La cuenta tiene que EXISTIR ya. No se crea aquí: un administrador se designa
// sobre alguien que ya ha entrado en el producto con su propia contraseña.
const usuario = await buscarUsuario(correo);
if (!usuario) {
  console.error(
    `No hay ninguna cuenta con el correo ${correo}. Que entre primero en la aplicación y vuelve a ejecutar esto.`,
  );
  process.exit(1);
}

if (retirar) {
  const { error } = await db.from("platform_admins").delete().eq("user_id", usuario.id);
  if (error) throw new Error(error.message);
  console.log(`Retirado el acceso de administración a ${correo}.`);
  process.exit(0);
}

const { error } = await db.from("platform_admins").insert({
  user_id: usuario.id,
  note: `Alta manual con service_role el ${new Date().toISOString()}`,
});
if (error && error.code !== "23505") throw new Error(error.message);

console.log(
  error?.code === "23505"
    ? `${correo} ya era administrador de plataforma.`
    : `${correo} es ya administrador de plataforma. Entra en /admin.`,
);
console.log(
  "\nEsto NO le da acceso a ningún expediente: la administración de plataforma",
);
console.log("revisa acreditaciones y acceso comercial, y nada más.");
