import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["examples/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["examples/setup.ts"],
    testTimeout: 20000,
  },
});
