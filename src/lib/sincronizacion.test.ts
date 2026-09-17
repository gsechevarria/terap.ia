import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Las dos orillas tienen que refrescarse.
 *
 * `revalidatePath` sobre una ruta que nadie invalida no da ningún error: la
 * base queda bien y la pantalla enseña lo de antes. Es el fallo más difícil de
 * ver porque parece que "va lento" o que "hay que recargar".
 *
 * Ya pasó una vez en cada dirección:
 *
 *  · sep-2026 — el profesional creaba una tarea o una cita y el paciente
 *    seguía sin verla. Se arregló con `revalidatePaciente()`.
 *  · sep-2026 (esta) — el paciente CANCELABA una cita, marcaba una tarea o
 *    registraba su ánimo y el profesional seguía viendo lo de antes. La peor
 *    era la cita: lleva a presentarse a una sesión anulada.
 *
 * La regla que se comprueba es automática, no una lista que envejece: una
 * acción que resuelve la identidad del PACIENTE está escribiendo en su nombre,
 * así que algo del PROFESIONAL tiene que quedar invalidado. Y al revés.
 */

const acciones = fileURLToPath(new URL("./actions", import.meta.url));

/** Cuerpo de cada `async function …Impl(…)`, que es donde vive la lógica. */
function funciones(texto: string): { nombre: string; cuerpo: string }[] {
  const salida: { nombre: string; cuerpo: string }[] = [];
  const re = /async function (\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  const inicios: { nombre: string; desde: number }[] = [];
  while ((m = re.exec(texto))) inicios.push({ nombre: m[1]!, desde: m.index });
  for (let i = 0; i < inicios.length; i++) {
    const hasta = inicios[i + 1]?.desde ?? texto.length;
    salida.push({ nombre: inicios[i]!.nombre, cuerpo: texto.slice(inicios[i]!.desde, hasta) });
  }
  return salida;
}

const DEL_PROFESIONAL =
  /revalidateProfesional|revalidateAgenda|revalidateRequests|revalidatePayments|revalidatePath\(\s*["'`]\/pro/;
const DEL_PACIENTE = /revalidatePaciente|revalidateAgenda|revalidateRequests|revalidatePayments|revalidatePath\(\s*["'`]\/app/;

/** Escribe algo: si solo lee, no tiene nada que invalidar. */
const ESCRIBE = /\.rpc\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/;

function todasLasFunciones() {
  const salida: { fichero: string; nombre: string; cuerpo: string }[] = [];
  for (const f of readdirSync(acciones).filter((f) => f.endsWith(".ts"))) {
    const texto = readFileSync(join(acciones, f), "utf8");
    for (const fn of funciones(texto)) salida.push({ fichero: f, ...fn });
  }
  return salida;
}

describe("sincronización entre las dos áreas", () => {
  const fns = todasLasFunciones();

  it("hay acciones que analizar", () => {
    expect(fns.length).toBeGreaterThan(20);
  });

  it("toda escritura del paciente refresca alguna pantalla del profesional", () => {
    const fallos = fns
      .filter(
        (f) =>
          f.cuerpo.includes("getCurrentPatient") &&
          ESCRIBE.test(f.cuerpo) &&
          !DEL_PROFESIONAL.test(f.cuerpo),
      )
      .map(
        (f) =>
          `${f.fichero}: ${f.nombre} escribe como paciente y no invalida nada de /pro. ` +
          `El dato quedará bien en la base y el profesional seguirá viendo lo de antes.`,
      );

    expect(fallos).toEqual([]);
  });

  it("toda escritura del profesional sobre un paciente refresca su app", () => {
    // Solo las que tocan un expediente concreto: la contabilidad y el equipo
    // no los ve el paciente, y exigirles invalidar `/app` sería ruido.
    const fallos = fns
      .filter(
        (f) =>
          /patientId|patient_id/.test(f.cuerpo) &&
          f.cuerpo.includes("getCurrentProfessional") &&
          ESCRIBE.test(f.cuerpo) &&
          !DEL_PACIENTE.test(f.cuerpo),
      )
      .map(
        (f) =>
          `${f.fichero}: ${f.nombre} escribe sobre un expediente y no invalida nada de /app.`,
      );

    expect(fallos).toEqual([]);
  });
});
