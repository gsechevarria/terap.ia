#!/usr/bin/env node
/**
 * Verificación de producción por HTTP, sin credenciales y sin efectos.
 *
 * Comprueba lo que se puede comprobar desde fuera y sin sesión: cabeceras de
 * seguridad, política de contenido con nonce, protección de las rutas privadas,
 * artefactos de la PWA y los 401 de los route handlers. **No sustituye a la
 * revisión visual** (docs/REVISION-VISUAL.md): aquí no hay pantalla, ni sesión,
 * ni teclado.
 *
 *   node scripts/verificar-produccion.mjs [url-base]
 *
 * Solo hace peticiones de lectura. No envía credenciales ni escribe nada.
 */

const BASE = (process.argv[2] ?? "https://terap.vercel.app").replace(/\/$/, "");
const TIMEOUT_MS = 25_000;

let ok = 0;
const fallos = [];
const avisos = [];

function comprobar(nombre, condicion, detalle = "") {
  if (condicion) {
    ok++;
    console.log(`  OK   ${nombre}`);
  } else {
    fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ""}`);
    console.log(`  FALLO ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function anotar(nombre, detalle) {
  avisos.push(`${nombre} — ${detalle}`);
  console.log(`  nota  ${nombre} — ${detalle}`);
}

async function pedir(ruta, opciones = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${ruta}`, {
      redirect: "manual",
      signal: control.signal,
      headers: { "user-agent": "verificar-produccion/1.0" },
      ...opciones,
    });
  } finally {
    clearTimeout(reloj);
  }
}

// --- Cabeceras de seguridad y CSP -------------------------------------------

async function cabeceras() {
  console.log("\nCabeceras de seguridad y CSP");
  const res = await pedir("/");
  comprobar("/ responde 200", res.status === 200, `status ${res.status}`);

  const csp = res.headers.get("content-security-policy") ?? "";
  const directiva = (nombre) =>
    csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(nombre)) ?? "";

  const scriptSrc = directiva("script-src");
  comprobar("script-src lleva nonce", /'nonce-[A-Za-z0-9+/=]+'/.test(scriptSrc), scriptSrc);
  comprobar("script-src lleva strict-dynamic", scriptSrc.includes("'strict-dynamic'"));
  comprobar("script-src SIN unsafe-eval", !scriptSrc.includes("'unsafe-eval'"), scriptSrc);
  comprobar("script-src SIN unsafe-inline", !scriptSrc.includes("'unsafe-inline'"), scriptSrc);
  comprobar("frame-ancestors 'none'", directiva("frame-ancestors") === "frame-ancestors 'none'");
  comprobar("object-src 'none'", directiva("object-src") === "object-src 'none'");
  comprobar("base-uri 'self'", directiva("base-uri") === "base-uri 'self'");
  comprobar("form-action 'self'", directiva("form-action") === "form-action 'self'");
  comprobar("upgrade-insecure-requests", csp.includes("upgrade-insecure-requests"));
  comprobar(
    "connect-src permite Supabase por wss",
    /wss:\/\/\S+\.supabase\.co/.test(directiva("connect-src")),
    directiva("connect-src"),
  );

  comprobar("X-Frame-Options: DENY", res.headers.get("x-frame-options") === "DENY");
  comprobar("X-Content-Type-Options: nosniff", res.headers.get("x-content-type-options") === "nosniff");
  comprobar("Referrer-Policy sin referer", (res.headers.get("referrer-policy") ?? "").includes("no-referrer"));
  comprobar("HSTS con preload", (res.headers.get("strict-transport-security") ?? "").includes("preload"));
  comprobar("Permissions-Policy cierra cámara y micrófono", /camera=\(\)/.test(res.headers.get("permissions-policy") ?? ""));

  // El nonce tiene que cambiar en cada petición: si se cachea, deja de servir.
  const otra = await pedir("/");
  const nonce = (h) => (h.headers.get("content-security-policy") ?? "").match(/'nonce-([^']+)'/)?.[1];
  comprobar("el nonce cambia entre peticiones", nonce(res) !== nonce(otra) && !!nonce(otra));

  const html = await res.text();
  comprobar("la portada declara el entorno de demostración", /demostraci[óo]n|datos ficticios/i.test(html));
}

// --- Rutas privadas sin sesión ----------------------------------------------

const PRIVADAS = [
  "/pro", "/pro/patients", "/pro/agenda", "/pro/pagos", "/pro/analitica", "/pro/solicitudes",
  "/pro/contabilidad", "/pro/contabilidad/gastos", "/pro/ajustes",
  "/app", "/app/appointments", "/app/appointments/new", "/app/diary",
  "/app/resources", "/app/more", "/app/settings",
];

async function rutasPrivadas() {
  console.log("\nRutas privadas sin sesión");
  for (const ruta of PRIVADAS) {
    const res = await pedir(ruta);
    const destino = res.headers.get("location") ?? "";
    comprobar(
      `${ruta} redirige al acceso`,
      [301, 302, 303, 307, 308].includes(res.status) && destino.includes("/login"),
      `status ${res.status}${destino ? ` → ${destino}` : ""}`,
    );
  }

  console.log("\nRutas públicas");
  for (const ruta of ["/", "/login"]) {
    const res = await pedir(ruta);
    comprobar(`${ruta} responde 200`, res.status === 200, `status ${res.status}`);
  }
}

// --- Route handlers ---------------------------------------------------------

async function handlers() {
  console.log("\nRoute handlers sin autorización");

  const cron = await pedir("/api/cron/notifications");
  comprobar("el cron sin autorización responde 401", cron.status === 401, `status ${cron.status}`);

  const cronMal = await pedir("/api/cron/notifications", {
    headers: { authorization: "Bearer no-es-el-secreto" },
  });
  comprobar("el cron con secreto incorrecto responde 401", cronMal.status === 401, `status ${cronMal.status}`);

  // El proxy llega antes que el handler: sin sesión corta con un redirect, y el
  // 401 del handler es la segunda capa, alcanzable solo con sesión iniciada.
  for (const ruta of ["/files?path=x/y.pdf", "/receipts?path=x/y.pdf"]) {
    const res = await pedir(ruta);
    const destino = res.headers.get("location") ?? "";
    comprobar(
      `${ruta.split("?")[0]} sin sesión no sirve el archivo`,
      [301, 302, 303, 307, 308].includes(res.status) ? destino.includes("/login") : res.status === 401,
      `status ${res.status}${destino ? ` → ${destino}` : ""}`,
    );
  }

  const salud = await pedir("/api/health");
  comprobar("/api/health responde 200 o 503", [200, 503].includes(salud.status), `status ${salud.status}`);
  if (salud.status === 503) anotar("/api/health", "responde 503: la base no contesta");
}

// --- PWA --------------------------------------------------------------------

async function pwa() {
  console.log("\nArtefactos de la PWA");

  const manifiesto = await pedir("/manifest.webmanifest");
  comprobar("el manifiesto responde 200", manifiesto.status === 200, `status ${manifiesto.status}`);
  if (manifiesto.status === 200) {
    const datos = await manifiesto.json();
    comprobar("el manifiesto arranca en /app", datos.start_url === "/app", String(datos.start_url));
    comprobar("el manifiesto es standalone", datos.display === "standalone", String(datos.display));
    comprobar("el manifiesto declara iconos", Array.isArray(datos.icons) && datos.icons.length > 0);
  }

  const sw = await pedir("/sw.js");
  comprobar("el service worker responde 200", sw.status === 200, `status ${sw.status}`);
  comprobar(
    "el service worker se sirve como javascript",
    (sw.headers.get("content-type") ?? "").includes("javascript"),
    sw.headers.get("content-type") ?? "",
  );

  for (const icono of ["/icon-192.png", "/icon-512.png"]) {
    const res = await pedir(icono);
    comprobar(`${icono} responde 200`, res.status === 200, `status ${res.status}`);
  }

  // El service worker la precachea con `cache.addAll`, que rechaza un redirect:
  // si el proxy la protegiera, una sesión caducada rompería toda la instalación.
  const offline = await pedir("/offline.html");
  comprobar("/offline.html responde 200 sin sesión", offline.status === 200, `status ${offline.status}`);
  if (offline.status === 200) {
    const texto = await offline.text();
    comprobar("/offline.html trae el teléfono 024", texto.includes("024"));
  }
}

// --- Vuelta desde el correo de autenticación --------------------------------

/**
 * A dónde devuelve Supabase después de verificar un enlace de correo.
 *
 * Es configuración del panel, no código, así que no la ve ninguna prueba del
 * repositorio — y cuando está mal rompe el alta entera sin dejar ni un error en
 * los registros de la aplicación. Pasó el 17-sep: el «Site URL» estaba puesto
 * como `terap.vercel.app`, **sin esquema**, así que Supabase lo trataba como
 * una ruta relativa y el enlace de confirmación aterrizaba en
 * `<proyecto>.supabase.co/terap.vercel.app` → `requested path is invalid`.
 * Ocurre igual aunque la verificación salga bien: el destino está roto solo.
 *
 * Se comprueba con un token deliberadamente inválido. La verificación falla
 * —que es justo lo que se quiere: no se consume el enlace de nadie— y en la
 * redirección de vuelta viaja el destino configurado.
 *
 * El proyecto de Supabase se deduce de la propia CSP, que es donde la
 * aplicación declara con quién habla. Es información pública, no un secreto, y
 * así la comprobación no necesita configurarse.
 */
async function vueltaDeCorreo() {
  console.log("\nVuelta desde el correo de autenticación");

  const res = await pedir("/login");
  const proyecto = (res.headers.get("content-security-policy") ?? "").match(
    /https:\/\/[a-z0-9]+\.supabase\.co/,
  )?.[0];

  if (!proyecto) {
    anotar("proyecto de Supabase", "no se deduce de la CSP; no se comprueba el destino de vuelta");
    return;
  }

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  let destino;
  try {
    const verify = await fetch(
      `${proyecto}/auth/v1/verify?token=token-invalido-de-verificacion&type=signup`,
      {
        redirect: "manual",
        signal: control.signal,
        headers: { "user-agent": "verificar-produccion/1.0" },
      },
    );
    destino = verify.headers.get("location");
  } finally {
    clearTimeout(reloj);
  }

  if (!destino) {
    anotar("destino de vuelta", "la verificación no redirigió; no se deduce el Site URL");
    return;
  }

  // Lo que delata el fallo: un destino relativo es un Site URL sin esquema.
  comprobar(
    "el Site URL de Supabase es absoluto",
    /^https?:\/\//.test(destino),
    `redirige a «${destino}» — falta el esquema en Authentication → URL Configuration`,
  );

  if (/^https?:\/\//.test(destino)) {
    comprobar(
      "el Site URL apunta a esta aplicación",
      new URL(destino).origin === new URL(BASE).origin,
      `redirige a ${new URL(destino).origin}, no a ${new URL(BASE).origin}`,
    );
  }
}

// --- Ejecución --------------------------------------------------------------

console.log(`Verificación de ${BASE} — solo lectura, sin credenciales`);

try {
  await cabeceras();
  await rutasPrivadas();
  await handlers();
  await pwa();
  await vueltaDeCorreo();
} catch (error) {
  console.error(`\nLa verificación se interrumpió: ${error.message}`);
  process.exit(2);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos.length} fallos, ${avisos.length} notas.`);
if (avisos.length) {
  console.log("\nNotas:");
  for (const aviso of avisos) console.log(`  - ${aviso}`);
}
if (fallos.length) {
  console.log("\nFallos:");
  for (const fallo of fallos) console.log(`  - ${fallo}`);
  process.exit(1);
}
console.log("\nEsto NO cubre la revisión visual: ver docs/REVISION-VISUAL.md.");
