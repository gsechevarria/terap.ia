import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { colegioPorClaveONombre } from "./index";
import { comprobarColegiacion, MOTIVO, type Veredicto } from "./verificar";

export type ResultadoVerificacion = {
  veredicto: Veredicto;
  /** Lo que hizo la base: 'approved', 'recorded', 'not_pending', 'duplicate' o 'error'. */
  resultado: string;
  motivo: string;
};

/**
 * Comprueba un alta contra el registro de su colegio y lo anota.
 *
 * Corre SOLO en el servidor: consulta el registro él mismo, con los datos que
 * se acaban de guardar, y es él quien decide si pide aprobar. Nada de lo que
 * diga el navegador llega a `registry_verify_professional`, que además solo
 * acepta `service_role`.
 *
 * Nunca lanza. Si algo falla —la web del colegio, la clave de servicio—, el
 * alta sigue su curso normal: pendiente de una persona.
 */
export async function verificarAltaEnRegistro(datos: {
  professionalId: string;
  colegio: string | null;
  numero: string | null;
  nombre: string;
}): Promise<ResultadoVerificacion> {
  const colegio = colegioPorClaveONombre(datos.colegio);
  const evidencia = await comprobarColegiacion(
    colegio?.integracion ?? null,
    datos.numero ?? "",
    datos.nombre,
  );

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("registry_verify_professional", {
      p_professional_id: datos.professionalId,
      p_evidence: evidencia,
      p_approve: evidencia.veredicto === "coincide",
    });
    if (error) throw new Error(error.message);
    return { veredicto: evidencia.veredicto, resultado: data ?? "recorded", motivo: evidencia.detalle };
  } catch (e) {
    console.error("verificarAltaEnRegistro", e instanceof Error ? e.message : e);
    return { veredicto: evidencia.veredicto, resultado: "error", motivo: MOTIVO.error };
  }
}
