import { describe, expect, it } from "vitest";
import {
  aplicarPorcentaje,
  baseDesdeTotal,
  prorratear,
  redondearCentimos,
  sumar,
} from "./dinero";
import { NOMBRE_TERRITORIO, obtenerReglas, reglasPendientes } from "./reglas";
import {
  evaluarModelo111,
  evaluarModelo115,
  evaluarModelo130,
  evaluarModelosIva,
  type DatosObligaciones,
} from "./obligaciones";

describe("aritmética monetaria en céntimos", () => {
  it("suma sin arrastrar error de coma flotante", () => {
    // En euros con `number`, 0.1 + 0.2 no es 0.3. En céntimos enteros, sí.
    expect(sumar(10, 20)).toBe(30);
    const muchas = Array.from({ length: 1000 }, () => 10);
    expect(sumar(...muchas)).toBe(10_000);
  });

  it("extrae la base de un total con IVA incluido", () => {
    expect(baseDesdeTotal(12_100, 21)).toBe(10_000);
    expect(baseDesdeTotal(11_000, 10)).toBe(10_000);
    // Exenta: el total ES la base.
    expect(baseDesdeTotal(5_000, 0)).toBe(5_000);
  });

  it("aplica porcentajes redondeando al céntimo", () => {
    expect(aplicarPorcentaje(10_000, 21)).toBe(2_100);
    expect(aplicarPorcentaje(3_333, 15)).toBe(500); // 499,95 → 500
  });

  it("redondea el medio céntimo hacia arriba en valor absoluto", () => {
    expect(redondearCentimos(0.5)).toBe(1);
    // Simétrico: un abono no se redondea en dirección contraria a su cargo.
    expect(redondearCentimos(-0.5)).toBe(-1);
  });

  it("prorratea por días sin dividir por cero", () => {
    expect(prorratear(36_500, 100, 365)).toBe(10_000);
    expect(prorratear(1_000, 1, 0)).toBe(0);
  });
});

describe("reglas por ejercicio y territorio", () => {
  it("territorio común 2026 está soportado", () => {
    const reglas = obtenerReglas(2026, "comun");
    expect(reglas.soportado).toBe(true);
    expect(reglas.umbralExencion130Pct.valor).toBe(70);
    expect(reglas.dificilJustificacionTopeCents.valor).toBe(200_000);
  });

  it("no extrapola territorio común a los forales ni a Canarias", () => {
    for (const territorio of ["alava", "bizkaia", "gipuzkoa", "navarra", "canarias"] as const) {
      const reglas = obtenerReglas(2026, territorio);
      expect(reglas.soportado, NOMBRE_TERRITORIO[territorio]).toBe(false);
      expect(reglas.pagoFraccionadoPct.valor).toBeNull();
      expect(reglas.pagoFraccionadoPct.estado).toBe("pendiente");
    }
  });

  it("un ejercicio sin reglas no hereda las del anterior", () => {
    const reglas = obtenerReglas(2027, "comun");
    expect(reglas.soportado).toBe(false);
    expect(reglas.dificilJustificacionPct.valor).toBeNull();
  });

  it("sin territorio declarado asume común y lo marca como asumido", () => {
    const reglas = obtenerReglas(2026, null);
    expect(reglas.soportado).toBe(true);
    expect(reglas.territorio).toBe("comun");
    expect(reglas.territorioAsumido).toBe(true);
    // Y el aviso viaja hasta el expediente, no se queda en el tipo.
    expect(reglasPendientes(reglas).join(" ")).toContain("se ha asumido");
  });

  it("un territorio confirmado no arrastra el aviso", () => {
    const reglas = obtenerReglas(2026, "comun", true);
    expect(reglas.territorioAsumido).toBe(false);
    expect(reglasPendientes(reglas).join(" ")).not.toContain("se ha asumido");
  });

  it("asumir común NO alcanza a los forales: siguen sin reglas", () => {
    const reglas = obtenerReglas(2026, "bizkaia", false);
    expect(reglas.soportado).toBe(false);
    expect(reglas.pagoFraccionadoPct.valor).toBeNull();
  });

  it("toda regla verificada cita su fuente", () => {
    const reglas = obtenerReglas(2026, "comun");
    const valores = [
      reglas.pagoFraccionadoPct,
      reglas.retencionGeneralPct,
      reglas.dificilJustificacionPct,
      reglas.umbralExencion130Pct,
    ];
    for (const regla of valores) {
      expect(regla.estado).toBe("verificada");
      expect(regla.fuente.length).toBeGreaterThan(0);
      expect(regla.verificadoEl).not.toBeNull();
    }
  });

  it("el primer año del modelo 130 sigue pendiente y se declara como tal", () => {
    const reglas = obtenerReglas(2026, "comun");
    expect(reglas.exencion130PrimerAnio.estado).toBe("pendiente");
    expect(reglasPendientes(reglas).join(" ")).toContain("primer año");
  });
});

const BASE: DatosObligaciones = {
  ejercicio: 2026,
  territorio: "comun",
  regimen: "estimacion_directa_simplificada",
  anioAltaActividad: 2020,
  ingresosAnioAnteriorCents: 5_000_000,
  ingresosConRetencionAnioAnteriorCents: 4_000_000,
  situacionIva: "exenta",
  tieneEmpleados: false,
  tieneColaboradoresConRetencion: false,
  tieneAlquileresConRetencion: false,
};

describe("obligaciones: sin datos no se decide", () => {
  it("con el 80 % de ingresos retenidos no hay obligación de modelo 130", () => {
    const r = evaluarModelo130(BASE);
    expect(r.determinacion).toBe("no_obligado");
    expect(r.explicacion).toContain("80.0 %");
  });

  it("por debajo del 70 % sí hay obligación", () => {
    const r = evaluarModelo130({ ...BASE, ingresosConRetencionAnioAnteriorCents: 3_000_000 });
    expect(r.determinacion).toBe("obligado");
  });

  it("sin ingresos del año anterior queda PENDIENTE, no exento", () => {
    const r = evaluarModelo130({ ...BASE, ingresosAnioAnteriorCents: null });
    expect(r.determinacion).toBe("pendiente");
    expect(r.faltan?.join(" ")).toContain("2025");
  });

  it("cero ingresos el año anterior no es cero por ciento: queda pendiente", () => {
    const r = evaluarModelo130({
      ...BASE,
      ingresosAnioAnteriorCents: 0,
      ingresosConRetencionAnioAnteriorCents: 0,
    });
    expect(r.determinacion).toBe("pendiente");
  });

  it("el primer año de actividad queda pendiente del criterio del gestor", () => {
    const r = evaluarModelo130({ ...BASE, anioAltaActividad: 2026 });
    expect(r.determinacion).toBe("pendiente");
  });

  it("un territorio sin reglas verificadas no determina la obligación", () => {
    const r = evaluarModelo130({ ...BASE, territorio: "navarra" });
    expect(r.determinacion).toBe("pendiente");
  });

  it("no responder sobre empleados no equivale a no tenerlos", () => {
    const sinResponder = evaluarModelo111({ ...BASE, tieneEmpleados: null });
    expect(sinResponder.determinacion).toBe("pendiente");
    const respondido = evaluarModelo111(BASE);
    expect(respondido.determinacion).toBe("no_obligado");
  });

  it("no responder sobre alquileres tampoco", () => {
    expect(
      evaluarModelo115({ ...BASE, tieneAlquileresConRetencion: null }).determinacion,
    ).toBe("pendiente");
  });

  it("actividad mixta obliga a IVA y deja el régimen de deducción al gestor", () => {
    const [iva] = evaluarModelosIva({ ...BASE, situacionIva: "mixta" });
    expect(iva?.determinacion).toBe("obligado");
    expect(iva?.explicacion).toContain("prorrata");
  });

  it("actividad exenta no obliga, pero no da la exención por buena sin más", () => {
    const [iva] = evaluarModelosIva(BASE);
    expect(iva?.determinacion).toBe("no_obligado");
    // No se afirma que la exención esté verificada: se recuerda de qué depende.
    expect(iva?.explicacion).toContain("titulación");
  });

  it("sin situación de IVA declarada, pendiente", () => {
    const [iva] = evaluarModelosIva({ ...BASE, situacionIva: null });
    expect(iva?.determinacion).toBe("pendiente");
  });
});
