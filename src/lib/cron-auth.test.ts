import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/cron/notifications/route";
afterEach(() => vi.unstubAllEnvs());
it("cron rechaza token Unicode con longitud de bytes diferente sin lanzar", async () => {
  vi.stubEnv("CRON_SECRET", "abc");
  const response = await GET(new NextRequest("https://example.invalid/api/cron/notifications", { headers: { authorization: "Bearer ñbc" } }));
  expect(response.status).toBe(401);
});
it("cron no acepta secretos por query", async () => {
  vi.stubEnv("CRON_SECRET", "ficticio");
  expect((await GET(new NextRequest("https://example.invalid/api/cron/notifications?secret=ficticio"))).status).toBe(401);
});
it("cron distingue configuración ausente de ejecución correcta", async () => {
  vi.stubEnv("CRON_SECRET", "ficticio"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
  const response = await GET(new NextRequest("https://example.invalid/api/cron/notifications", { headers: { authorization: "Bearer ficticio" } }));
  expect(response.status).toBe(503);
  expect((await response.json()).ok).toBe(false);
});
