import { getPanelDeHoy, ventanaValida } from "@/lib/queries/hoy";
import { getEmergencyLinks } from "@/lib/queries/emergency";
import { getContextoPropio } from "@/lib/queries/contexts";
import { fraseDelDia, saludo } from "@/lib/frase-del-dia";
import { minutesOfDayInTZ } from "@/lib/tz";
import { BarraJornada } from "@/app/pro/_components/hoy/BarraJornada";
import { TarjetaProximaSesion } from "@/app/pro/_components/hoy/TarjetaProximaSesion";
import { FranjaAviso } from "@/app/pro/_components/hoy/FranjaAviso";
import { AgendaDelDia } from "@/app/pro/_components/hoy/AgendaDelDia";
import { EstaSemana } from "@/app/pro/_components/hoy/EstaSemana";
import { SinProximaCita } from "@/app/pro/_components/hoy/SinProximaCita";
import { Cifras, GraficaOcupacion } from "@/app/pro/_components/hoy/Analitica";

type SP = { ocupacion?: string };

/**
 * «Hoy»: la pantalla que se abre al entrar.
 *
 * Todo se resuelve en el servidor. El único trozo de cliente es la línea de
 * «ahora» de la agenda, que necesita moverse sin recargar la página.
 *
 * El instante se calcula UNA vez, aquí, y baja como dato a todos los bloques:
 * si cada componente llamara a `new Date()`, la próxima sesión y la línea de
 * «ahora» podrían discrepar entre sí por los milisegundos que separan sus
 * renders.
 *
 * Escalas, diario y tareas no tienen sección propia en esta pantalla: viven en
 * la ficha del paciente. Lo único de escalas que aparece aquí es la tendencia
 * de quien entra por la puerta dentro de un rato y el aviso de ítem de riesgo,
 * que es lo que no puede esperar a que alguien abra una ficha.
 */
export default async function Hoy({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ventana = ventanaValida(sp.ocupacion);

  const ahora = new Date();
  const [panel, recursos, contexto] = await Promise.all([
    getPanelDeHoy(ahora, ventana),
    getEmergencyLinks(),
    getContextoPropio(),
  ]);

  const vivas = panel.sesiones.filter((s) => s.clase !== "cancelada" && s.clase !== "no-acudio");
  const frase = fraseDelDia({
    sesiones: vivas.length,
    primera: vivas[0]?.desde ?? null,
    ultima: vivas.at(-1)?.hasta ?? null,
    huecos: panel.huecos.map((h) => ({ desde: h.desde, minutos: h.hasta - h.desde })),
    sinConfirmar: panel.sesiones.filter((s) => s.clase === "sin-confirmar").length,
  });

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Saludo y próxima sesión */}
      <div className="flex flex-col gap-7 lg:flex-row lg:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 py-1">
          <div>
            <h1 className="page-title">
              {saludo(minutesOfDayInTZ(ahora), contexto?.full_name ?? null)}
            </h1>
            <p className="mt-3 max-w-[500px] text-body-lg text-ink-2">{frase}</p>
          </div>
          <BarraJornada
            tramos={panel.tramos}
            minutosDeSesion={panel.minutosDeSesion}
            ventana={panel.ventana}
          />
        </div>

        <TarjetaProximaSesion sesion={panel.proxima} ahoraISO={panel.ahoraISO} />
      </div>

      {/* Aviso de seguridad: siempre delante de todo lo demás. */}
      <FranjaAviso avisos={panel.avisos} recursos={recursos} ahoraISO={panel.ahoraISO} />

      {/* Planificación: agenda del día a la izquierda, semana y pendientes a la derecha. */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <AgendaDelDia
          sesiones={panel.sesiones}
          bloqueos={panel.bloqueos}
          huecos={panel.huecos}
          ventana={panel.ventana}
          ahoraMinutoInicial={panel.ahoraMinuto}
          hoyYMD={panel.hoyYMD}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <EstaSemana semana={panel.semana} />
          <SinProximaCita pacientes={panel.sinProximaCita} />
        </div>
      </div>

      {/* Analítica operativa, separada por una línea y no por otra caja. */}
      <div className="flex flex-col gap-8 border-t border-line pt-[22px] lg:flex-row">
        <GraficaOcupacion semanas={panel.ocupacion} ventana={ventana} />
        <Cifras cifras={panel.cifras} />
      </div>
    </div>
  );
}
