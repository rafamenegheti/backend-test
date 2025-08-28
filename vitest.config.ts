import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "drizzle/",
        "dist/",
        "**/*.config.*",
        "src/server.ts",
        "src/database/seed.ts",
      ],
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    maxConcurrency: 1,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  esbuild: {
    target: "node18",
  },
});
