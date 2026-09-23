/**
 * La frase que resume la jornada bajo el saludo de «Hoy».
 *
 * Es lógica pura y vive aquí, fuera de la vista, por dos motivos: se puede
 * probar con casos escritos a mano (`frase-del-dia.test.ts`) y no se puede
 * colar en ella un dato que no venga de la agenda.
 *
 * Reglas de redacción, que son las del sistema visual:
 *  · describe, no interpreta. «Queda un hueco de hora y media» es un hecho;
 *    «aprovecha para descansar» sería un consejo, y esta aplicación no aconseja.
 *  · nada de metadatos encadenados con «·»: son oraciones, con comas y puntos.
 *  · si no hay nada que contar, lo dice y ya está; no se rellena.
 */

export type ResumenJornada = {
  /** Sesiones vivas del día (ni canceladas ni marcadas como no acudió). */
  sesiones: number;
  /** Minuto de inicio de la primera y de fin de la última, en el día. */
  primera: number | null;
  ultima: number | null;
  /** Huecos libres, en minutos de duración y con su minuto de inicio. */
  huecos: { desde: number; minutos: number }[];
  /** Citas del día aún sin confirmar. */
  sinConfirmar: number;
};

function hhmm(minuto: number): string {
  const h = Math.floor(minuto / 60);
  const m = minuto % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Duración en palabras. «Hora y media» se lee mejor que «1 h 30 min» dentro de
 * una frase; en una tabla sería al revés, y por eso esto no es el formateador
 * general (`formatDuracion`), que sigue existiendo para las tablas.
 */
export function duracionEnPalabras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} minutos`;
  if (h === 1 && m === 0) return "una hora";
  if (h === 1 && m === 30) return "hora y media";
  if (m === 0) return `${h} horas`;
  if (m === 30) return `${h} horas y media`;
  return `${h} h ${m} min`;
}

function momentoDelDia(minuto: number): string {
  if (minuto < 12 * 60) return "por la mañana";
  if (minuto < 20 * 60) return "por la tarde";
  return "por la noche";
}

/**
 * Tratamientos que pueden encabezar el nombre de un profesional.
 *
 * Se comparan sin punto y en minúscula, así que «Dra.», «dra» y «DRA.» son el
 * mismo caso.
 */
const TRATAMIENTOS = new Set([
  "dr",
  "dra",
  "d",
  "dn",
  "dna",
  "don",
  "doña",
  "sr",
  "sra",
  "srta",
  "lic",
  "lcdo",
  "lcda",
  "ps",
  "psic",
  "psico",
  "prof",
  "profa",
  "mtro",
  "mtra",
]);

const sinPunto = (s: string) => s.replace(/\.+$/, "").toLowerCase();

/**
 * Cómo llamar a alguien en el saludo.
 *
 * Coger la primera palabra a secas no vale: un `full_name` de «Dra. Ana
 * Romero» daba «Buenas noches, Dra.», que saluda al tratamiento y no a la
 * persona. Si la primera palabra es un tratamiento, se conserva y se le añade
 * el nombre que venga detrás — «Dra. Ana» —, que es como se dirige uno a una
 * colega en español sin quitarle el título.
 *
 * Si no hay nada detrás del tratamiento, se devuelve tal cual: es lo único que
 * consta, y es mejor que no saludar.
 */
export function tratamientoYNombre(nombre: string | null): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  const primera = partes[0];
  if (!primera) return "";
  if (!TRATAMIENTOS.has(sinPunto(primera))) return primera;
  const segunda = partes[1];
  return segunda ? `${primera} ${segunda}` : primera;
}

/**
 * El nombre sin el tratamiento que lo encabece.
 *
 * Lo usan el avatar de la barra lateral —cuyas iniciales deben salir de la
 * persona y no del título— y la comparación con el nombre de la consulta. Si
 * detrás del tratamiento no queda nada, se devuelve el original: vale más un
 * «Dra.» que una cadena vacía.
 */
export function sinTratamiento(nombre: string | null): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  const primera = partes[0];
  if (!primera) return "";
  if (!TRATAMIENTOS.has(sinPunto(primera))) return partes.join(" ");
  const resto = partes.slice(1);
  return resto.length > 0 ? resto.join(" ") : primera;
}

/** Saludo según la hora de pared en Madrid. */
export function saludo(minutoDelDia: number, nombre: string | null): string {
  const franja =
    minutoDelDia < 6 * 60
      ? "Buenas noches"
      : minutoDelDia < 14 * 60
        ? "Buenos días"
        : minutoDelDia < 21 * 60
          ? "Buenas tardes"
          : "Buenas noches";
  const propio = tratamientoYNombre(nombre);
  return propio ? `${franja}, ${propio}` : franja;
}

/** Frase descriptiva de la jornada. Devuelve "" si no hay nada que decir. */
export function fraseDelDia(r: ResumenJornada): string {
  const partes: string[] = [];

  if (r.sesiones === 0) {
    partes.push("Hoy no tienes ninguna sesión agendada.");
  } else if (r.primera != null && r.ultima != null) {
    partes.push(
      r.sesiones === 1
        ? `Hoy tienes una sesión, a las ${hhmm(r.primera)}.`
        : `Hoy tienes ${r.sesiones} sesiones entre las ${hhmm(r.primera)} y las ${hhmm(r.ultima)}.`,
    );
  } else {
    partes.push(r.sesiones === 1 ? "Hoy tienes una sesión." : `Hoy tienes ${r.sesiones} sesiones.`);
  }

  // Solo se menciona el hueco mayor, y solo si da para algo: decir que quedan
  // diez minutos libres entre dos sesiones no es información, es ruido.
  const segundaFrase: string[] = [];
  const mayor = [...r.huecos].sort((a, b) => b.minutos - a.minutos)[0];
  if (mayor && mayor.minutos >= 45 && r.sesiones > 0) {
    segundaFrase.push(
      `queda un hueco de ${duracionEnPalabras(mayor.minutos)} ${momentoDelDia(mayor.desde)}`,
    );
  }
  if (r.sinConfirmar > 0) {
    segundaFrase.push(
      r.sinConfirmar === 1 ? "una cita sin confirmar" : `${r.sinConfirmar} citas sin confirmar`,
    );
  }

  if (segundaFrase.length === 1) {
    partes.push(`${mayúscula(segundaFrase[0] ?? "")}.`);
  } else if (segundaFrase.length === 2) {
    partes.push(`${mayúscula(segundaFrase[0] ?? "")} y ${segundaFrase[1]}.`);
  }

  return partes.join(" ");
}

function mayúscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
