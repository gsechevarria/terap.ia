import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests de LÓGICA PURA. No tocan la base de datos ni la red: los scripts de
 * integración viven aparte (`npm run test:integration:*`) precisamente para que
 * `npm test` no pueda dispararlos por accidente contra Supabase.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/database.types.ts", "src/lib/**/*.test.ts"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
