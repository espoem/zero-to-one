/**
 * Test helper: run the project's pinned TypeScript 7 compiler (`tsc` from node_modules)
 * against a fixture project and capture its diagnostics.
 *
 * TypeScript 7 ships a native (Go) binary. `typescript/bin/tsc` is a small Node launcher
 * that locates and executes it, so we spawn it with the current Node binary.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const tsPackageJson = require.resolve("typescript/package.json");
export const TSC_BIN = path.join(path.dirname(tsPackageJson), "bin", "tsc");

export interface TscResult {
  readonly status: number | null;
  readonly output: string;
  /** Diagnostic codes in order of appearance, e.g. ["TS2591", "TS2882"]. */
  readonly codes: readonly string[];
}

export function runTsc(args: readonly string[], cwd: string): TscResult {
  const result = spawnSync(process.execPath, [TSC_BIN, ...args], {
    cwd,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const codes = [...output.matchAll(/error (TS\d+)/g)].map((m) => m[1] ?? "");
  return { status: result.status, output, codes };
}

export function fixture(metaUrl: string, ...segments: string[]): string {
  return path.join(path.dirname(new URL(metaUrl).pathname), "fixtures", ...segments);
}
