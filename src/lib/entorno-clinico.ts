/**
 * Lo que la aplicación AFIRMA sobre su propio entorno, en un solo sitio.
 *
 * Esta franja es visible de forma permanente y habla de tratamiento de datos de
 * salud. Los artículos 13 y 14 del RGPD obligan a que esa información sea
 * exacta, así que aquí no se escribe nada "porque queda bien": cada valor tiene
 * su procedencia anotada, y corregir una afirmación es cambiar una línea.
 *
 * ⚠️ Antes del primer paciente real hay que revisar los tres valores con el
 * responsable del tratamiento. Hoy el entorno es de demostración.
 */

/**
 * Ubicación del nodo que procesa los datos.
 *
 * Por defecto la región REAL del proyecto Supabase (`.env.example`, línea 1:
 * "Supabase — proyecto en EU (Frankfurt)"). Se puede sobrescribir cuando la
 * infraestructura cambie, pero el valor mostrado debe corresponder siempre con
 * dónde se procesan los datos de verdad: decir otra cosa en la interfaz es una
 * información inexacta sobre transferencias y ubicación del tratamiento.
 */
export const NODO_CLINICO =
  process.env.NEXT_PUBLIC_CLINICAL_NODE?.trim() || "UE · Frankfurt";

/**
 * Cifrado declarado.
 *
 * Supabase cifra en reposo y exige TLS en tránsito. El modo concreto del
 * cifrado en reposo lo aporta el proveedor y NO se ha verificado desde este
 * repositorio, así que se declara lo comprobable —que hay cifrado AES-256— y no
 * un detalle de implementación que nadie de aquí ha contrastado. Si el
 * responsable del tratamiento confirma el modo exacto, se pone aquí.
 */
export const CIFRADO = process.env.NEXT_PUBLIC_CLINICAL_CIPHER?.trim() || "AES-256";

/** Marco normativo aplicable al tratamiento. */
export const MARCO_NORMATIVO = "RGPD UE 2016/679";

/**
 * Modo demostración: encendido salvo que se apague explícitamente.
 *
 * El lado seguro del error es que el aviso siga puesto. Mientras esté activo,
 * la franja NO puede presentarse como un entorno clínico en producción: son
 * datos ficticios y no hay DPA ni base jurídica del artículo 9.
 */
export const MODO_DEMOSTRACION = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
