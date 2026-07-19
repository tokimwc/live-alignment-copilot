import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@lac/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@lac/planner": fileURLToPath(new URL("./packages/planner/src/index.ts", import.meta.url)),
      "@lac/scene-engine": fileURLToPath(
        new URL("./packages/scene-engine/src/index.ts", import.meta.url),
      ),
      "@lac/test-fixtures": fileURLToPath(
        new URL("./packages/test-fixtures/src/index.ts", import.meta.url),
      ),
      "@lac/web": fileURLToPath(new URL("./apps/web/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/*.test.ts"],
    globals: false,
  },
});
