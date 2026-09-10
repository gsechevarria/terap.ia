import { describe, it, expect } from "vitest";
import { importeEuros } from "@/lib/schemas/common";
import { updateGastoSchema, configuracionFiscalRefined } from "@/lib/schemas/contabilidad";
import { amortizacionEjercicio, amortizacionHastaTrimestre } from "@/lib/fiscal/helpers";
import { trimestreActual } from "@/lib/fiscal/calendario";
import { fromWallClock } from "@/lib/tz";
import { allRows, checked } from "@/lib/query-result";
import { assignmentIsDue } from "@/lib/assignment-due";
import { csvCell } from "@/lib/csv";
import { beforeSend, scrubUrl } from "@/lib/sentry-scrub";
import { isAllowedPushEndpoint, safeNotificationPath } from "@/lib/push-safety";
import { validateUpload } from "@/lib/upload-policy";

describe("regresiones económicas", () => {
  it.each([["29.90", 2990], ["60.00", 6000], ["1.234,56", 123456], ["0", 0], ["12,34", 1234]])("%s conserva céntimos", (raw, cents) => expect(Math.round(importeEuros.parse(raw) * 100)).toBe(cents));
  it.each(["", "1.234", "1e3", "1,2,3", "-1", "Infinity", "21474836.48"])("rechaza entrada ambigua o inválida %s", raw => expect(importeEuros.safeParse(raw).success).toBe(false));
  it("editar sin datos de inversión no los convierte en false", () => {
    const parsed = updateGastoSchema.parse({ id: "00000000-0000-4000-8000-000000000001", fecha: "2026-07-01", categoria_deducible: "software", base: "60.00" });
    expect(parsed.base).toBe(60); expect(parsed.es_bien_inversion).toBeUndefined(); expect(parsed.porcentaje_amortizacion).toBeUndefined(); expect(parsed.anios_amortizacion).toBeUndefined();
  });
  it("la fecha de alta opcional acepta vacío", () => expect(configuracionFiscalRefined.parse({ fecha_alta_actividad: "" }).fecha_alta_actividad).toBeNull());
  const bien = { id: "b", descripcion: "Ficticio", fechaAdquisicion: "2026-07-01", valorAdquisicion: 1000, porcentajeAmortizacion: 25, aniosAmortizacion: 4 };
  it("amortiza todo el coste sin excederlo", () => {
    const amounts = Array.from({ length: 10 }, (_, i) => amortizacionEjercicio(bien, 2026 + i));
    expect(amounts.reduce((a,b)=>a+b,0)).toBeCloseTo(1000, 2);
    expect(amortizacionEjercicio(bien, 2035)).toBe(0);
    expect(amortizacionHastaTrimestre(bien, 2026, 2)).toBe(0);
  });
  it("el bisiesto no amortiza más de una anualidad", () => expect(amortizacionEjercicio({ ...bien, fechaAdquisicion: "2028-01-01" }, 2028)).toBe(250));
});
describe("consultas completas y errores", () => {
  it("pagina más de 1000 filas incluso con un límite del servidor inferior", async () => {
    const rows = Array.from({length: 2305},(_,id)=>({id}));
    const q = { order: () => ({ range: async (from: number) => ({ data: rows.slice(from, from+137), error: null }) }) };
    expect((await allRows(q)).data).toEqual(rows);
  });
  it("una página fallida no devuelve un total parcial", async () => {
    const q = { order: () => ({ range: async () => ({data: null, error: {message: "secreto"}}) }) };
    await expect(allRows(q)).rejects.toThrow("No se pudieron obtener");
    await expect(checked(Promise.resolve({data: [], error:{message:"fallo"}}))).rejects.toThrow();
  });
});
describe("fechas y periodicidad", () => {
  it("el 1 de abril en Madrid ya es segundo trimestre", () => expect(trimestreActual(new Date("2026-04-01T00:30:00+02:00"))).toEqual({trimestre:2,anio:2026}));
  it("rechaza la hora que no existe en primavera", () => expect(Number.isNaN(fromWallClock(2026,3,29,2,30).getTime())).toBe(true));
  it("elige explícitamente la primera hora repetida de otoño", () => expect(fromWallClock(2026,10,25,2,30).toISOString()).toBe("2026-10-25T00:30:00.000Z"));
  const a={active:true,starts_on:"2026-01-01",ends_on:null,assignment_type:"recurring",recurrence_interval_days:7};
  it("respeta frecuencia y finalización puntual",()=>{
    const now=new Date("2026-09-09T12:00:00Z");
    expect(assignmentIsDue(a,"2026-09-08T12:00:00Z",now)).toBe(false);
    expect(assignmentIsDue(a,"2026-09-02T12:00:00Z",now)).toBe(true);
    expect(assignmentIsDue({...a,assignment_type:"one_off"},"2026-09-01T00:00:00Z",now)).toBe(false);
  });
});
describe("privacidad y exportación",()=>{
  it.each(["=1+1"," +SUM(A1)","@cmd","-cmd","\t=1"])("neutraliza fórmulas de texto %s",v=>expect(csvCell(v).startsWith("'")).toBe(true));
  it("conserva números negativos como números",()=>expect(csvCell(-12)).toBe("-12"));
  it("no envía texto clínico ni tokens a Sentry",()=>{
    const secret="a".repeat(64);
    const event=beforeSend({type:undefined,message:"Paciente Ficticio: nota",transaction:"/onboarding/"+secret,tags:{patient_name:"Ficticio"},extra:{route:"secreto"},request:{url:"/onboarding/"+secret+"?code=abc"}});
    expect(JSON.stringify(event)).not.toContain(secret);expect(JSON.stringify(event)).not.toContain("Ficticio");expect(JSON.stringify(event)).not.toContain("secreto");
    expect(scrubUrl("/onboarding/"+secret)).toBe("/onboarding/[segmento]");
  });
  it.each(["https://127.0.0.1/probe","https://localhost/probe","https://fcm.googleapis.com.evil.test/x","https://fcm.googleapis.com:9443/x","https://user@fcm.googleapis.com/x"])("bloquea endpoint %s",v=>expect(isAllowedPushEndpoint(v)).toBe(false));
  it("permite proveedores y limita navegación",()=>{expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);expect(safeNotificationPath("//evil.test")).toBe("/");});
  it("rechaza tipos activos y exceso de tamaño",()=>{expect(()=>validateUpload("files",20,"text/html")).toThrow();expect(()=>validateUpload("files",20971521,"application/pdf")).toThrow();});
});
