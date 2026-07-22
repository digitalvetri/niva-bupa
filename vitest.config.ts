import { defineConfig } from "vitest/config";

export default defineConfig({
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
