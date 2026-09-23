import { ActionForm } from "@/components/ui/ActionForm";
import { getConfiguracionFiscal } from "@/lib/queries/contabilidad";
import { upsertConfiguracionFiscalAction } from "@/lib/actions/contabilidad";
import { REGIMEN_LABEL, SITUACION_IVA_LABEL, trimestreActual } from "@/lib/fiscal";
import { DescargoFiscal } from "../_components/DescargoFiscal";
import { NavContabilidad } from "@/app/pro/contabilidad/_components/NavContabilidad";

export default async function ConfiguracionFiscalPage() {
  const cfg = await getConfiguracionFiscal();
  const { anio } = trimestreActual(new Date());

  return (
    <div>
      <h1 className="page-title">Configuración fiscal</h1>
      <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">
        Estos datos ajustan las estimaciones. No se envían a ningún organismo.
      </p>

      <div className="mt-[22px]">
        <NavContabilidad ejercicio={anio} />
      </div>

      <DescargoFiscal className="mt-[22px]" />

      {/* Formulario largo: se agrupa con títulos y líneas, no metiendo cada
          grupo en su propia tarjeta. */}
      <ActionForm action={upsertConfiguracionFiscalAction} className="mt-7 max-w-2xl">
        <section>
          <h2 className="section-title">Régimen e IVA</h2>
          <div className="mt-4 flex flex-col gap-4">
            <label className="block">
              <span className="field-label">Régimen de IRPF</span>
              <select
                name="regimen"
                defaultValue={cfg?.regimen ?? "estimacion_directa_simplificada"}
                className="field"
              >
                {(
                  Object.keys(REGIMEN_LABEL) as (keyof typeof REGIMEN_LABEL)[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {REGIMEN_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">Situación de IVA</span>
              <select
                name="situacion_iva"
                defaultValue={cfg?.situacion_iva ?? "exenta"}
                className="field"
              >
                {(
                  Object.keys(SITUACION_IVA_LABEL) as (keyof typeof SITUACION_IVA_LABEL)[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {SITUACION_IVA_LABEL[k]}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[12px] text-ink-3">
                La psicología suele estar exenta de IVA (art. 20.Uno.3º LIVA).
              </span>
            </label>

            <label className="block">
              <span className="field-label">% IVA repercutido</span>
              <input
                type="number"
                name="tipo_iva_repercutido"
                min={0}
                max={100}
                step="1"
                defaultValue={cfg?.tipo_iva_repercutido ?? 21}
                className="field"
              />
              <span className="mt-1.5 block text-[12px] text-ink-3">
                Solo se usa si la actividad NO es exenta: sirve para separar la base
                imponible del IVA en los cobros que registres.
              </span>
            </label>

            <label className="block">
              <span className="field-label">
                Prorrata de IVA (%) — obligatoria en régimen mixto
              </span>
              <input
                type="number"
                name="prorrata_iva_pct"
                min={0}
                max={100}
                step="1"
                defaultValue={cfg?.prorrata_iva_pct ?? ""}
                className="field"
              />
              <span className="mt-1.5 block text-[12px] text-ink-3">
                Porcentaje del IVA soportado que recuperas vía modelo 303. En exenta
                es 0 y en sujeta 100, y se deduce solo. En{" "}
                <strong className="font-medium">mixta</strong> hay que
                indicarlo: sin este dato no se puede saber qué parte del IVA de tus
                gastos es coste deducible en IRPF, y el cálculo se detiene en vez de
                suponerlo.
              </span>
            </label>
          </div>
        </section>

        <section className="mt-7 border-t border-line pt-6">
          <h2 className="section-title">Datos de la actividad</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Epígrafe IAE</span>
              <input
                type="text"
                name="epigrafe_iae"
                defaultValue={cfg?.epigrafe_iae ?? "776"}
                className="field"
                placeholder="776"
              />
            </label>
            <label className="block">
              <span className="field-label">Fecha de alta en la actividad</span>
              <input
                type="date"
                name="fecha_alta_actividad"
                defaultValue={cfg?.fecha_alta_actividad ?? ""}
                className="field"
              />
              <span className="mt-1.5 block text-[12px] text-ink-3">
                Determina la retención reducida (7%) del alta + 2 años.
              </span>
            </label>
          </div>
        </section>

        <section className="mt-7 border-t border-line pt-6">
          <h2 className="section-title">Retención en tus ingresos</h2>
          <label className="mt-4 flex items-start gap-2.5 text-[13.5px] text-ink">
            <input
              type="checkbox"
              name="aplica_retencion_default"
              defaultChecked={cfg?.aplica_retencion_default ?? false}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              Mis ingresos llevan retención de IRPF por defecto
              <span className="mt-0.5 block text-[12px] text-ink-3">
                Normalmente NO en pacientes particulares; sí si facturas a empresas
                o entidades que retienen.
              </span>
            </span>
          </label>
        </section>

        <div className="mt-7 border-t border-line pt-6">
          <button type="submit" className="btn-primary">
            Guardar configuración
          </button>
        </div>
      </ActionForm>
    </div>
  );
}
