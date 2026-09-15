import { type NextRequest } from "next/server";
import { getFiscalArrays } from "@/lib/queries/contabilidad";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { buildCsv, buildPdf, buildXlsx } from "@/lib/fiscal/export-docs";
import {
  construirLibros,
  calcularResumenAnual,
  getParams,
  type FiltroPeriodo,
  type Trimestre,
} from "@/lib/fiscal";

// --- Handler ----------------------------------------------------------------
/** Los libros registro llevan ingresos y proveedores: fuera de toda caché. */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

export async function GET(req: NextRequest) {
  // Los route handlers NO ejecutan layouts: aunque esta ruta viva bajo /pro, no
  // hereda la guardia de ProLayout. La comprobación de sesión va aquí.
  const pro = await getCurrentProfessional();
  if (!pro) {
    return new Response("No autorizado", { status: 401, headers: NO_STORE });
  }

  const sp = req.nextUrl.searchParams;
  const formato = sp.get("formato") ?? "xlsx";
  const ejercicio = Number.parseInt(sp.get("ejercicio") ?? "", 10);
  const periodoRaw = sp.get("periodo") ?? "anual";

  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    return new Response("Ejercicio no válido", { status: 400, headers: NO_STORE });
  }
  const trimestre =
    periodoRaw === "1" || periodoRaw === "2" || periodoRaw === "3" || periodoRaw === "4"
      ? (Number(periodoRaw) as Trimestre)
      : undefined;
  const filtro: FiltroPeriodo = { ejercicio, trimestre };

  const params = getParams(ejercicio);
  const data = await getFiscalArrays(ejercicio);
  const libros = construirLibros(data, filtro, params);
  const resumen = calcularResumenAnual(data, ejercicio, params);

  const suffix = trimestre ? `-${trimestre}T` : "";
  const baseName = `contabilidad-${ejercicio}${suffix}`;

  if (formato === "csv") {
    return new Response(buildCsv(libros, resumen, filtro), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        ...NO_STORE,
      },
    });
  }
  if (formato === "pdf") {
    const bytes = await buildPdf(resumen, filtro);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        ...NO_STORE,
      },
    });
  }
  // xlsx por defecto
  const buf = buildXlsx(libros, resumen, filtro);
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      ...NO_STORE,
    },
  });
}
