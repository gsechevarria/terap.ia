import { describe, expect, it, vi } from "vitest";
import { ActionInputError, callAction } from "./action-result";
import { contentSecurityPolicy } from "./csp";
import { deducibleIrpf } from "./fiscal/helpers";
import { libroIngresos, libroBienesInversion } from "./fiscal/libros";
import { CONFIG_FISCAL_DEFAULT, type FiscalArrays } from "./fiscal/types";
import { getParams } from "./fiscal/parametros";

describe("protocolo de acciones", () => {
  it("entrega el resultado confirmado", async () => {
    await expect(callAction(async (value: number) => ({ success: true as const, data: value + 1 }), 4)).resolves.toBe(5);
  });
  it("un fallo no dispara la continuación de éxito", async () => {
    const done = vi.fn();
    await expect(callAction(async () => ({ success: false as const, error: "Revisa el importe" })).then(done)).rejects.toThrow(ActionInputError);
    expect(done).not.toHaveBeenCalled();
  });
  it("un fallo de transporte tampoco confirma éxito", async () => {
    await expect(callAction(async () => { throw new Error("red"); })).rejects.toThrow("red");
  });
});
it("CSP autoriza scripts por nonce sin inline ni eval en producción", () => {
  vi.stubEnv("NODE_ENV", "production");
  const directive = contentSecurityPolicy("nonce-ficticio").split(";").find(x => x.trim().startsWith("script-src"));
  expect(directive).toContain("'nonce-nonce-ficticio'");
  expect(directive).not.toMatch(/unsafe-inline|unsafe-eval/);
  vi.unstubAllEnvs();
});
it("el IVA confirmado del gasto prevalece sobre cambios de configuración", () => {
  expect(deducibleIrpf({ base: 100, cuotaIva: 21, porcentajeAfectacion: 50, ivaRecuperablePct: 0 }, "sujeta")).toBe(60.5);
});
it("los libros exportan la retención confirmada y la última fracción de amortización", () => {
  const data: FiscalArrays = { config: CONFIG_FISCAL_DEFAULT, ingresos: [{ id: "1", fecha: "2026-01-01", total: 121, base: 100, cuotaIva: 21,
    tipoOperacion: "sujeta", retencionAplicable: true, retencion: 7, nombrePagador: "Ficticio" }], gastos: [],
    bienes: [{ id: "2", descripcion: "Equipo", fechaAdquisicion: "2022-07-01", valorAdquisicion: 1000, porcentajeAmortizacion: 25, aniosAmortizacion: 4 }] };
  expect(libroIngresos(data, { ejercicio: 2026 }, getParams(2026)).rows[0]?.[8]).toBe(7);
  expect(libroBienesInversion(data, { ejercicio: 2026 }).rows).toHaveLength(1);
});
