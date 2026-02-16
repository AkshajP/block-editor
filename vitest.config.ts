import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use node environment for unit tests (no DOM needed)
    environment: "node",
    globals: true,
    // Include test files matching this pattern
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.offline.test.{ts,tsx}"],
    // Setup files to run before tests
    setupFiles: [],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.offline.test.{ts,tsx}",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
