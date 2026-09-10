import { describe, expect, it } from "vitest";
import { calcularModelo130 } from "./modelo130";
import {
  amortizacionEjercicio,
  deducibleIrpf,
  redondear,
  trimestreAdquisicion,
  trimestreDeFecha,
} from "./helpers";
import { PARAMS_2026 } from "./parametros";
import type { BienInversionFiscal } from "./types";

/*
 * Los valores esperados están escritos A MANO, no recalculados con la misma
 * función que se prueba: es el defecto de la batería de integración actual y
 * repetirlo dejaría los tests sin poder de detección.
 */

const P = PARAMS_2026;

const base130 = {
  params: P,
  regimen: "estimacion_directa_simplificada" as const,
  retencionesSoportadasAcumuladas: 0,
  pagosFraccionadosPreviosDelAnio: 0,
};

describe("calcularModelo130", () => {
  it("rendimiento negativo → no se paga nada", () => {
    const r = calcularModelo130({
      ...base130,
      trimestre: 1,
      ingresosAcumulados: 1000,
      gastosDeduciblesAcumulados: 4000,
    });
    expect(r.rendimientoNeto).toBe(-3000);
    // Con rendimiento negativo no hay 5 % de difícil justificación.
    expect(r.gastosDificilJustificacion).toBe(0);
    expect(r.cuota).toBe(0);
    expect(r.pagoTrimestre).toBe(0);
  });

  it("aplica el 5 % de difícil justificación cuando no llega al tope", () => {
    // 10.000 − 4.000 = 6.000 → 5 % = 300 (tope 1T = 2000/4 = 500, no aplica)
    // base = 5.700 → 20 % = 1.140
    const r = calcularModelo130({
      ...base130,
      trimestre: 1,
      ingresosAcumulados: 10_000,
      gastosDeduciblesAcumulados: 4_000,
    });
    expect(r.rendimientoNeto).toBe(6000);
    expect(r.gastosDificilJustificacion).toBe(300);
    expect(r.baseLiquidacion).toBe(5700);
    expect(r.cuota).toBe(1140);
    expect(r.pagoTrimestre).toBe(1140);
  });

  it("PRORRATEA el tope de difícil justificación por trimestre", () => {
    // Con 60.000 € de rendimiento en el 1T, el 5 % son 3.000, por encima del
    // tope. El tope ANUAL es 2.000, pero al 1T solo corresponde 2000/4 = 500.
    // Antes se restaban los 2.000 enteros y se declaraban 300 € de menos
    // (20 % de 1.500), que reaparecían como regularización en el 4T.
    const q1 = calcularModelo130({
      ...base130,
      trimestre: 1,
      ingresosAcumulados: 60_000,
      gastosDeduciblesAcumulados: 0,
    });
    expect(q1.gastosDificilJustificacion).toBe(500);
    expect(q1.baseLiquidacion).toBe(59_500);
    expect(q1.cuota).toBe(11_900);

    const q4 = calcularModelo130({
      ...base130,
      trimestre: 4,
      ingresosAcumulados: 60_000,
      gastosDeduciblesAcumulados: 0,
    });
    expect(q4.gastosDificilJustificacion).toBe(2000); // tope anual completo
  });

  it("en estimación directa NORMAL no hay difícil justificación", () => {
    const r = calcularModelo130({
      ...base130,
      regimen: "estimacion_directa_normal",
      trimestre: 4,
      ingresosAcumulados: 10_000,
      gastosDeduciblesAcumulados: 4_000,
    });
    expect(r.gastosDificilJustificacion).toBe(0);
    expect(r.baseLiquidacion).toBe(6000);
    expect(r.cuota).toBe(1200);
  });

  it("retenciones mayores que la cuota no producen un pago negativo", () => {
    const r = calcularModelo130({
      ...base130,
      trimestre: 4,
      ingresosAcumulados: 10_000,
      gastosDeduciblesAcumulados: 4_000,
      retencionesSoportadasAcumuladas: 5_000,
    });
    expect(r.cuota).toBe(1140);
    expect(r.pagoTrimestre).toBe(0);
  });

  it("descuenta los pagos fraccionados previos del año", () => {
    const r = calcularModelo130({
      ...base130,
      trimestre: 2,
      ingresosAcumulados: 20_000,
      gastosDeduciblesAcumulados: 8_000,
      pagosFraccionadosPreviosDelAnio: 1_140,
    });
    // 12.000 − min(600, 1000) = 11.400 → 20 % = 2.280 − 1.140 = 1.140
    expect(r.gastosDificilJustificacion).toBe(600);
    expect(r.cuota).toBe(2280);
    expect(r.pagoTrimestre).toBe(1140);
  });

  it("marca la estimación como no verificada si intervienen parámetros sin confirmar", () => {
    const r = calcularModelo130({
      ...base130,
      trimestre: 1,
      ingresosAcumulados: 10_000,
      gastosDeduciblesAcumulados: 0,
    });
    expect(r.estimacionNoVerificada).toBe(true);
    expect(r.parametrosNoVerificados.length).toBeGreaterThan(0);
  });

  it("no marca nada si el régimen no usa difícil justificación", () => {
    const r = calcularModelo130({
      ...base130,
      regimen: "estimacion_directa_normal",
      trimestre: 1,
      ingresosAcumulados: 10_000,
      gastosDeduciblesAcumulados: 0,
    });
    expect(r.estimacionNoVerificada).toBe(false);
  });
});

// ---------------------------------------------------------------- amortización

const bien = (
  fecha: string,
  valor = 3000,
  pct = 25,
  anios: number | null = null,
): BienInversionFiscal => ({
  id: "b1",
  descripcion: "Portátil",
  fechaAdquisicion: fecha,
  valorAdquisicion: valor,
  porcentajeAmortizacion: pct,
  aniosAmortizacion: anios,
});

describe("amortizacionEjercicio", () => {
  it("comprado en un ejercicio anterior → año completo", () => {
    expect(amortizacionEjercicio(bien("2025-03-10"), 2026)).toBe(750);
  });

  it("comprado el 1 de enero → prácticamente el año completo", () => {
    // 365 días de 2026 desde el 1-ene: 750 × 365/365 = 750
    expect(amortizacionEjercicio(bien("2026-01-01"), 2026)).toBe(750);
  });

  it("comprado el 15 de noviembre → solo los 47 días que quedan", () => {
    // 16 días de noviembre + 31 de diciembre = 47 → 750 × 47/365 = 96,58
    expect(amortizacionEjercicio(bien("2026-11-15"), 2026)).toBe(96.58);
  });

  it("comprado en un ejercicio posterior → 0", () => {
    expect(amortizacionEjercicio(bien("2027-02-01"), 2026)).toBe(0);
  });

  it("conserva el saldo aunque los años declarados no coincidan con el coeficiente", () => {
    // Comprado en 2023 con 3 años de vida: 2023, 2024 y 2025.
    expect(amortizacionEjercicio(bien("2023-01-01", 3000, 25, 3), 2026)).toBe(750);
    expect(amortizacionEjercicio(bien("2023-01-01", 3000, 25, 3), 2025)).toBe(750);
  });
});

describe("trimestreAdquisicion", () => {
  it("de un ejercicio anterior cuenta desde el 1T", () => {
    expect(trimestreAdquisicion(bien("2025-11-15"), 2026)).toBe(1);
  });
  it("del propio ejercicio, su trimestre", () => {
    expect(trimestreAdquisicion(bien("2026-11-15"), 2026)).toBe(4);
    expect(trimestreAdquisicion(bien("2026-04-01"), 2026)).toBe(2);
  });
  it("de un ejercicio posterior, null", () => {
    expect(trimestreAdquisicion(bien("2027-01-01"), 2026)).toBeNull();
  });
});

// --------------------------------------------------------------- deducibleIrpf

const gasto = { base: 100, cuotaIva: 21, porcentajeAfectacion: 100 };

describe("deducibleIrpf", () => {
  it("SUJETA: el IVA se recupera por el 303, no es coste", () => {
    expect(deducibleIrpf(gasto, "sujeta", 100)).toBe(100);
  });

  it("EXENTA: el IVA soportado es mayor coste deducible", () => {
    expect(deducibleIrpf(gasto, "exenta", 0)).toBe(121);
  });

  it("MIXTA con prorrata 40 %: solo el 60 % del IVA es coste", () => {
    // 100 + 21 × 0,6 = 112,60. Antes "mixta" caía en la rama de "exenta" y
    // sumaba los 21 € enteros, restando dos veces la parte recuperada.
    expect(deducibleIrpf(gasto, "mixta", 40)).toBe(112.6);
  });

  it("MIXTA sin prorrata: FALLA en vez de suponer el caso más favorable", () => {
    expect(() => deducibleIrpf(gasto, "mixta", null)).toThrow(/prorrata/i);
  });

  it("aplica el % de afectación", () => {
    expect(deducibleIrpf({ ...gasto, porcentajeAfectacion: 50 }, "exenta", 0)).toBe(
      60.5,
    );
    // 0 % de afectación es un valor legítimo, no "sin dato".
    expect(deducibleIrpf({ ...gasto, porcentajeAfectacion: 0 }, "exenta", 0)).toBe(0);
  });
});

describe("helpers de fecha fiscal", () => {
  it("trimestreDeFecha", () => {
    expect(trimestreDeFecha("2026-01-01")).toBe(1);
    expect(trimestreDeFecha("2026-03-31")).toBe(1);
    expect(trimestreDeFecha("2026-04-01")).toBe(2);
    expect(trimestreDeFecha("2026-12-31")).toBe(4);
  });

  it("redondear no arrastra el error de coma flotante", () => {
    expect(redondear(0.1 + 0.2)).toBe(0.3);
    expect(redondear(1.005)).toBe(1.01);
  });
});
