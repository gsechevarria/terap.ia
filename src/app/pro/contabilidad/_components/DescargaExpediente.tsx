import { CircleAlert, Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";

type PasoIncompleto = { clave: string; titulo: string; faltan: string[] };

const CONTENIDO = [
  {
    icono: FileText,
    nombre: "resumen.pdf",
    texto: "Resumen fiscal del ejercicio, legible sin abrir la aplicación.",
  },
  {
    icono: FileSpreadsheet,
    nombre: "libros.xlsx",
    texto: "Libros registro en hojas separadas, más la hoja de resumen.",
  },
  {
    icono: Table2,
    nombre: "registros/*.csv",
    texto: "Facturas anotadas, retenciones y pagos a cuenta, y documentación personal.",
  },
  {
    icono: FileText,
    nombre: "manifiesto.json, advertencias.txt, indice.txt",
    texto:
      "Fecha, ejercicio, versión de las reglas aplicadas y todo lo que queda fuera de las cifras.",
  },
];

/**
 * Descarga del expediente completo en un ZIP.
 *
 * Se descarga aunque falten pasos, a propósito: un expediente a medias sigue
 * siendo útil para que el gestor diga qué falta, y bloquear la descarga solo
 * conseguiría que se reenviaran capturas de pantalla. Lo que sí se hace es que
 * lo incompleto viaje escrito: en el nombre del fichero, en `advertencias.txt`
 * y en el manifiesto.
 */
export function DescargaExpediente({
  ejercicio,
  pasosIncompletos,
  registrosApartados,
}: {
  ejercicio: number;
  pasosIncompletos: PasoIncompleto[];
  /** Cobros, gastos o bienes sin tratamiento fiscal, que NO entran en el ZIP. */
  registrosApartados: number;
}) {
  const incompleto = pasosIncompletos.length > 0 || registrosApartados > 0;

  return (
    <section className="card p-6">
      <h2 className="card-title">Expediente para la gestoría</h2>
      <p className="mt-1.5 text-body-sm text-ink-2">
        Un solo archivo comprimido con todo lo del ejercicio {ejercicio}. No es
        una declaración ni sirve para presentar ante la AEAT: es el material para
        que su gestor la prepare.
      </p>

      <ul className="mt-4 divide-y divide-line">
        {CONTENIDO.map(({ icono: Icono, nombre, texto }) => (
          <li key={nombre} className="flex items-start gap-3 py-3">
            <Icono
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className="mt-0.5 shrink-0 text-ink-3"
            />
            <div className="min-w-0">
              <p className="mono text-[12px] text-ink">{nombre}</p>
              <p className="mt-0.5 text-[12px] text-ink-2">{texto}</p>
            </div>
          </li>
        ))}
      </ul>

      {incompleto && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md bg-warning-soft px-4 py-3 text-[13.5px] text-ink">
          <CircleAlert
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="mt-0.5 shrink-0 text-warning-ink"
          />
          <div className="min-w-0">
            <p>
              El expediente está incompleto, así que el archivo se descargará
              como{" "}
              <span className="mono">expediente-fiscal-{ejercicio}-INCOMPLETO.zip</span>{" "}
              y llevará dentro el detalle de qué falta.
            </p>
            <ul className="mt-1.5 list-inside list-disc text-[12px] text-ink-2">
              {registrosApartados > 0 && (
                <li>
                  {registrosApartados} registros sin tratamiento fiscal confirmado
                  que no entran en ninguna cifra.
                </li>
              )}
              {pasosIncompletos.map((p) => (
                <li key={p.clave}>
                  {p.titulo}
                  {p.faltan.length > 0 ? `: ${p.faltan.join("; ")}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/*
        Enlace, no botón con fetch: el navegador descarga el archivo por su
        cuenta, sin mantener megabytes en memoria de la pestaña ni necesitar
        JavaScript. `download` fija el nombre solo si el servidor no manda
        Content-Disposition, y sí lo manda.
      */}
      <a
        href={`/pro/contabilidad/expediente/${ejercicio}/export`}
        download
        className="btn-primary mt-5 inline-flex items-center gap-2"
      >
        <Download size={15} strokeWidth={1.75} aria-hidden />
        Descargar expediente {ejercicio} (ZIP)
      </a>

      <p className="mt-3 text-[12px] text-ink-3">
        Si su gestor prefiere un formato suelto, en{" "}
        <a href="/pro/contabilidad/exportar" className="underline hover:text-ink-2">
          Exportar
        </a>{" "}
        están el Excel, el PDF y el CSV por separado, con filtro por trimestre.
      </p>
    </section>
  );
}
