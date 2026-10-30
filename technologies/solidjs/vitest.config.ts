import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";

// Two postures, as documented in the @solidjs/vite-plugin README ("Testing"):
// - client: jsdom + browser export conditions + DOM codegen (dev build, so diagnostics fire)
// - server: node + server export conditions + SSR codegen (isServer === true)
export default defineConfig({
  plugins: [solid()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          include: ["examples/typescript/**/*.test.{ts,tsx}"],
          exclude: ["examples/typescript/**/*.server.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["examples/typescript/**/*.server.test.{ts,tsx}"],
        },
      },
    ],
  },
});
