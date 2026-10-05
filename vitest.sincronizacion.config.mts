import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Prueba de SINCRONIZACIÓN entre el panel del profesional y la app del
 * paciente, contra Supabase LOCAL (nunca el remoto: `local-only.mjs`).
 *
 * Ejecuta las server actions y las consultas REALES de la aplicación —no
 * copias en SQL— con un cliente de Supabase autenticado como cada usuario.
 * Lo único que se sustituye es lo que solo existe dentro de un servidor Next:
 * las cookies (el cliente es el del usuario activo), `server-only` y
 * `revalidatePath`, que se registra para comprobar qué pantallas invalida
 * cada escritura.
 *
 * `npm run test:sincronizacion`. Lee `.env.test` (lo escribe
 * `scripts/write-local-env.mjs`). Separada de `npm test` a propósito: esa
 * batería no toca la red.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/sincronizacion/**/*.test.ts"],
    setupFiles: ["tests/sincronizacion/entorno.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/sincronizacion/vacio.ts", import.meta.url)),
    },
  },
});
