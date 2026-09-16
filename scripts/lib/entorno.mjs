/**
 * Comprobación del entorno para los scripts que hablan con Supabase.
 *
 * Existe porque el mensaje anterior —"Faltan NEXT_PUBLIC_SUPABASE_URL o
 * SUPABASE_SERVICE_ROLE_KEY"— no distinguía entre dos problemas que se
 * arreglan de forma distinta:
 *
 *   · el fichero de entorno no se cargó (ruta mal, `node` a pelo en vez de
 *     `npm run`, fichero en otra carpeta), o
 *   · el fichero sí se cargó pero esa variable concreta no está dentro.
 *
 * NUNCA imprime valores: solo NOMBRES de variable y si están o no. Un script
 * de diagnóstico que vuelca la `service_role` en la terminal es peor que el
 * problema que resuelve.
 */

/** Variables que se esperan en un `.env.local` de este proyecto. */
const CONOCIDAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "CRON_SECRET",
  "VAPID_PRIVATE_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];

/**
 * Exige las variables dadas. Si falta alguna, explica exactamente qué pasa y
 * termina el proceso.
 */
export function exigirEntorno(requeridas) {
  const faltan = requeridas.filter((v) => !process.env[v]);
  if (faltan.length === 0) {
    return Object.fromEntries(requeridas.map((v) => [v, process.env[v]]));
  }

  const presentes = CONOCIDAS.filter((v) => process.env[v]);

  console.error("\nNo puedo continuar: falta configuración.\n");
  console.error("  Falta:");
  for (const v of faltan) console.error(`    · ${v}`);

  if (presentes.length === 0) {
    // Ni una sola variable conocida: el fichero no se ha cargado.
    console.error("\n  NINGUNA variable del proyecto está definida, así que el");
    console.error("  problema no es esa variable: es que el fichero de entorno no");
    console.error("  se ha cargado. Comprueba, por este orden:\n");
    console.error("    1. Que lo lanzas con `npm run ...` desde la RAÍZ del");
    console.error("       proyecto, no con `node` a pelo ni desde scripts/.");
    console.error("    2. Que en la raíz existe el fichero de entorno local");
    console.error("       (mismo que usa `npm run seed:demo`).");
    console.error("    3. Que no tiene comillas sin cerrar: Node deja de leer");
    console.error("       el resto del fichero a partir de una línea mal formada.\n");
  } else {
    // El fichero sí se cargó: el problema es esa variable en concreto.
    console.error("\n  El fichero de entorno SÍ se ha cargado — hay otras");
    console.error("  variables definidas:\n");
    for (const v of presentes) console.error(`    · ${v}`);
    console.error("\n  Así que lo que falta es añadir la(s) de arriba. Los nombres");
    console.error("  exactos están en .env.example. Ojo a las mayúsculas y a que no");
    console.error("  haya espacios alrededor del `=`.\n");
  }

  process.exit(1);
}
