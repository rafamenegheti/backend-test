import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Don't use the database setup for unit tests
    // setupFiles: ['./src/test/setup.ts'],
    coverage: {
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
    testTimeout: 5000,
    hookTimeout: 5000,
    include: ["src/test/unit/**/*.test.ts"],
  },
  esbuild: {
    target: "node18",
  },
});
