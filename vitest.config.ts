import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // DB-backed tests share one snapshot; keep the ingest/metric suite serial.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/globalSetup.ts"],
  },
});
