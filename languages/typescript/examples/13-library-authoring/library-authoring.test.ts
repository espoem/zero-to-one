/**
 * Module 13 — Library authoring, type performance and type tests.
 *
 * Builds a tiny ESM package with tsc 7 (isolatedDeclarations), checks it with
 * publint and "Are the types wrong?" (attw), and proves the compiler limits and
 * diagnostics the module teaches.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixture, runTsc } from "../utils/tsc.ts";

const require = createRequire(import.meta.url);
/** The track's node_modules directory (packages may hide package.json behind `exports`). */
const nodeModules = path.dirname(path.dirname(require.resolve("typescript/package.json")));
const packageJsonOf = (pkg: string): string => path.join(nodeModules, pkg, "package.json");
const binOf = (pkg: string, bin: string): string => {
  const pj = packageJsonOf(pkg);
  const meta = JSON.parse(readFileSync(pj, "utf8")) as { bin: Record<string, string> | string };
  const rel = typeof meta.bin === "string" ? meta.bin : meta.bin[bin];
  assert.ok(rel, `${pkg} has no bin ${bin}`);
  return path.join(path.dirname(pj), rel);
};
const runBin = (pkg: string, bin: string, args: string[], cwd: string) =>
  spawnSync(process.execPath, [binOf(pkg, bin), ...args], { cwd, encoding: "utf8", timeout: 120_000 });

test("isolatedDeclarations: declarations are emitted from syntax alone", () => {
  const dir = fixture(import.meta.url, "good-pkg");
  rmSync(path.join(dir, "dist"), { recursive: true, force: true });
  const r = runTsc(["-p", "."], dir);
  assert.equal(r.status, 0, r.output);
  const dts = readFileSync(path.join(dir, "dist", "index.d.ts"), "utf8");
  assert.match(dts, /export declare function toSlug\(input: string\): Slug;/);
});

test("isolatedDeclarations rejects an export whose type must be inferred (TS9013)", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "isolated-decl"));
  assert.ok(r.codes.includes("TS9013"), r.output);
});

test("publint accepts the good package and rejects 'types' after another condition", () => {
  const good = runBin("publint", "publint", ["."], fixture(import.meta.url, "good-pkg"));
  assert.equal(good.status, 0, good.stdout + good.stderr);
  const badDir = fixture(import.meta.url, "bad-pkg");
  rmSync(path.join(badDir, "dist"), { recursive: true, force: true });
  rmSync(path.join(badDir, "types"), { recursive: true, force: true });
  assert.equal(runTsc(["-p", "."], badDir).status, 0);
  const bad = runBin("publint", "publint", ["."], badDir);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stdout + bad.stderr, /types should be the first/);
});

test("attw (esm-only profile) passes the good package and finds FallbackCondition in the bad one", () => {
  const good = runBin("@arethetypeswrong/cli", "attw", ["--pack", ".", "--profile", "esm-only"], fixture(import.meta.url, "good-pkg"));
  assert.equal(good.status, 0, good.stdout + good.stderr);
  const bad = runBin(
    "@arethetypeswrong/cli",
    "attw",
    ["--pack", ".", "--profile", "esm-only", "--format", "json"],
    fixture(import.meta.url, "bad-pkg"),
  );
  assert.notEqual(bad.status, 0);
  const report = JSON.parse(bad.stdout) as { analysis: { problems: { kind: string }[] } };
  assert.ok(report.analysis.problems.some((p) => p.kind === "FallbackCondition"));
});

test("recursion limits in 7.0.2: non-tail recursion fails at 48 elements, tail recursion at 1000", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "depth"));
  const lines = r.output.split("\n").filter((l) => l.includes("TS2589"));
  assert.equal(lines.length, 2, r.output);
  assert.match(lines[0] ?? "", /index\.ts\(7,/); // Fail48
  assert.match(lines[1] ?? "", /index\.ts\(9,/); // Fail1000
});

test("a @ts-expect-error that no longer fires is itself an error (TS2578)", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "unused-expect-error"));
  assert.deepEqual(r.codes, ["TS2578"]);
});

test("--extendedDiagnostics and --generateTrace work in tsc 7", () => {
  const dir = fixture(import.meta.url, "good-pkg");
  const diag = runTsc(["-p", ".", "--noEmit", "--extendedDiagnostics"], dir);
  assert.match(diag.output, /Instantiations:\s+\d+/);
  const traceDir = mkdtempSync(path.join(os.tmpdir(), "zto-trace-"));
  try {
    const traced = runTsc(["-p", ".", "--noEmit", "--generateTrace", traceDir], dir);
    assert.equal(traced.status, 0, traced.output);
    const files = readdirSync(traceDir);
    assert.ok(files.includes("trace.json"));
    assert.ok(files.some((f) => /^types_\d+\.json$/.test(f)), files.join(","));
  } finally {
    rmSync(traceDir, { recursive: true, force: true });
  }
  assert.ok(existsSync(path.join(dir, "src", "index.ts")));
});

test("TS 7 JSDoc: @enum is not special and Closure function types are unsupported", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "jsdoc-ts7"));
  assert.ok(r.codes.includes("TS2749"), r.output); // `Color` is a value used as a type
  assert.ok(r.codes.includes("TS1005"), r.output); // `function(string): number` no longer parses
});

test("dual package: format-specific declarations pass attw (node16); one shared .d.ts masquerades", () => {
  const dual = runBin("@arethetypeswrong/cli", "attw", ["--pack", ".", "--profile", "node16"], fixture(import.meta.url, "dual-pkg"));
  assert.equal(dual.status, 0, dual.stdout + dual.stderr);
  const masq = runBin(
    "@arethetypeswrong/cli",
    "attw",
    ["--pack", ".", "--profile", "node16", "--format", "json"],
    fixture(import.meta.url, "masq-pkg"),
  );
  assert.notEqual(masq.status, 0);
  const report = JSON.parse(masq.stdout) as { analysis: { problems: { kind: string }[] } };
  assert.ok(report.analysis.problems.some((p) => p.kind === "FalseESM"), masq.stdout);
});

/** Write files into a fresh temp dir (fixtures that need node_modules cannot be committed). */
function scratch(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "zto-m13-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test("declaration emit: an inferred type that can't be named portably is TS2883 in tsc 7", () => {
  const dir = scratch({
    "node_modules/outer/package.json": '{ "name": "outer", "version": "1.0.0", "types": "index.d.ts" }',
    "node_modules/outer/index.d.ts": 'import type { Secret } from "inner";\nexport declare function make(): Secret;\n',
    "node_modules/outer/node_modules/inner/package.json": '{ "name": "inner", "version": "1.0.0", "types": "index.d.ts" }',
    "node_modules/outer/node_modules/inner/index.d.ts": "export interface Secret { s: string }\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: { module: "nodenext", declaration: true, emitDeclarationOnly: true, outDir: "out", rootDir: ".", types: [] },
      include: ["index.ts", "fixed.ts"],
    }),
    "index.ts": 'import { make } from "outer";\nexport const value = make();\n',
    "fixed.ts": 'import { make } from "outer";\n// Annotating with a type the consumer can name fixes it.\nexport const value2: { s: string } = make();\n',
  });
  try {
    const r = runTsc(["-p", "."], dir);
    assert.deepEqual(r.codes, ["TS2883"]);
    assert.match(r.output, /index\.ts/);
    assert.doesNotMatch(r.output, /fixed\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
