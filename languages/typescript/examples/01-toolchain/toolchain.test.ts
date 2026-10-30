/**
 * Module 01 — Toolchain & compiler model (TypeScript 7).
 *
 * Every test runs the pinned `tsc` 7.0.2 (or Node 26 itself) against a fixture project
 * and asserts the exact diagnostic codes, so the claims in modules/01 are executable.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixture, runTsc } from "../utils/tsc.ts";

const require = createRequire(import.meta.url);

test("the pinned compiler is TypeScript 7.0.x", () => {
  const { output, status } = runTsc(["--version"], process.cwd());
  assert.equal(status, 0);
  assert.match(output, /Version 7\.0\.\d+/);
});

test("TS 7 has no classic programmatic API on the main entry point", async () => {
  const ts = (await import("typescript")) as Record<string, unknown>;
  // 5.x/6.x: `import ts from "typescript"` exposed createProgram, transpileModule, ...
  assert.equal(typeof ts["createProgram"], "undefined");
  assert.equal(typeof ts["transpileModule"], "undefined");
  assert.equal(typeof ts["version"], "string");
  const pkg = require("typescript/package.json") as { exports: Record<string, string> };
  // 7.0.2 ships only *unstable* API subpaths; 7.1 promotes them to typescript/sync etc.
  assert.ok(Object.keys(pkg.exports).includes("./unstable/sync"));
});

test("TS 7 defaults: types: [] hides @types/node; side-effect imports are checked", () => {
  const { status, codes } = runTsc(["-p", "."], fixture(import.meta.url, "ts7-defaults"));
  assert.notEqual(status, 0);
  assert.ok(codes.includes("TS2591"), "Cannot find name 'process' (types default is [])");
  assert.ok(codes.includes("TS2882"), "unresolved side-effect import of ./styles.css");
});

test("fix: list types explicitly and declare an ambient module for assets", () => {
  const { status, output } = runTsc(["-p", "."], fixture(import.meta.url, "ts7-defaults-fixed"));
  assert.equal(status, 0, output);
});

test("options deprecated in 6.0 are hard errors in 7.0", () => {
  const { status, codes, output } = runTsc(["-p", "."], fixture(import.meta.url, "removed-options"));
  assert.notEqual(status, 0);
  assert.ok(codes.includes("TS5102"), "baseUrl has been removed");
  assert.ok(codes.filter((c) => c === "TS5108").length >= 3, output);
  assert.match(output, /moduleResolution=node10/);
  assert.match(output, /esModuleInterop=false/);
  assert.match(output, /target=ES5/);
});

test("rootDir defaults to the tsconfig directory: an inferred ./src layout is an error", () => {
  const broken = runTsc(["-p", "."], fixture(import.meta.url, "rootdir-error"));
  assert.ok(broken.codes.includes("TS5011"), broken.output);
  const fixed = runTsc(["-p", "."], fixture(import.meta.url, "rootdir-fixed"));
  assert.equal(fixed.status, 0, fixed.output);
});

test("erasableSyntaxOnly rejects enum, namespace, parameter properties and <T> casts", () => {
  const { codes } = runTsc(["-p", "."], fixture(import.meta.url, "erasable"));
  assert.ok(codes.filter((c) => c === "TS1294").length >= 4);
});

test("Node 26 strips types but refuses non-erasable syntax at runtime", () => {
  assert.equal(process.features.typescript, "strip");
  const run = spawnSync(process.execPath, [fixture(import.meta.url, "erasable", "runtime-enum.ts")], {
    encoding: "utf8",
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
});

test("passing files on the command line next to a tsconfig.json needs --ignoreConfig", () => {
  const dir = fixture(import.meta.url, "ignore-config");
  const refused = runTsc(["--noEmit", "index.ts"], dir);
  assert.ok(refused.codes.includes("TS5112"), refused.output);
  const accepted = runTsc(["--noEmit", "--ignoreConfig", "index.ts"], dir);
  assert.equal(accepted.status, 0, accepted.output);
});

test("--checkers and --singleThreaded are accepted (parallelism is a CLI concern)", () => {
  const dir = fixture(import.meta.url, "ts7-defaults-fixed");
  assert.equal(runTsc(["-p", ".", "--checkers", "2"], dir).status, 0);
  assert.equal(runTsc(["-p", ".", "--singleThreaded"], dir).status, 0);
});

test("const enums from another file cannot be used under isolatedModules (TS2748)", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "const-enum-isolated"));
  assert.deepEqual(r.codes, ["TS2748"]);
});

/** Emit the lowering fixture with a given target into a fresh temp dir and return the JS. */
function emitWithTarget(target: string, extra: string[] = []): { js: string; dir: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), "zto-lower-"));
  const r = runTsc(["-p", ".", "--target", target, "--outDir", dir, ...extra], fixture(import.meta.url, "lowering"));
  assert.equal(r.status, 0, r.output);
  return { js: readFileSync(path.join(dir, "index.js"), "utf8"), dir };
}

test("target controls lowering: `using` is lowered below esnext, kept at esnext", () => {
  const low = emitWithTarget("es2022");
  const native = emitWithTarget("esnext");
  try {
    assert.match(low.js, /__addDisposableResource/);
    assert.doesNotMatch(low.js, /\busing held\b/);
    assert.match(low.js, /#count/); // private fields are native in es2022
    assert.match(native.js, /using held = r;/);
  } finally {
    rmSync(low.dir, { recursive: true, force: true });
    rmSync(native.dir, { recursive: true, force: true });
  }
});

test("target es2015 lowers #private fields to WeakMap-based helpers", () => {
  const old = emitWithTarget("es2015");
  try {
    assert.match(old.js, /WeakMap/);
    assert.doesNotMatch(old.js, /#count/);
  } finally {
    rmSync(old.dir, { recursive: true, force: true });
  }
});

test("lib, not target, decides which built-ins exist (TS2550)", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "lib-mismatch"));
  assert.deepEqual(r.codes, ["TS2550"]);
  assert.match(r.output, /es2023/);
});

test("--showConfig prints the effective config after `extends` merging", () => {
  const r = runTsc(["-p", ".", "--showConfig"], fixture(import.meta.url, "extends-base"));
  const shown = JSON.parse(r.output) as { compilerOptions: Record<string, unknown> };
  assert.equal(shown.compilerOptions["strict"], false); // inherited from config/base.json
  assert.equal(shown.compilerOptions["noUncheckedIndexedAccess"], true);
  assert.equal(shown.compilerOptions["noEmit"], true);
});

test("incremental builds: a second run with no changes emits nothing", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "zto-incr-"));
  try {
    const args = ["-p", ".", "--target", "esnext", "--outDir", dir, "--incremental", "--tsBuildInfoFile", path.join(dir, "b.tsbuildinfo"), "--listEmittedFiles"];
    const first = runTsc(args, fixture(import.meta.url, "lowering"));
    assert.match(first.output, /TSFILE: .*index\.js/);
    assert.ok(readdirSync(dir).includes("b.tsbuildinfo"));
    const second = runTsc(args, fixture(import.meta.url, "lowering"));
    assert.doesNotMatch(second.output, /TSFILE: .*index\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failure mode: deleting outDir but keeping .tsbuildinfo leaves the outputs missing", () => {
  const out = mkdtempSync(path.join(os.tmpdir(), "zto-stale-out-"));
  const info = mkdtempSync(path.join(os.tmpdir(), "zto-stale-info-"));
  try {
    const args = ["-p", ".", "--target", "esnext", "--outDir", out, "--incremental", "--tsBuildInfoFile", path.join(info, "b.tsbuildinfo"), "--listEmittedFiles"];
    runTsc(args, fixture(import.meta.url, "lowering"));
    rmSync(out, { recursive: true, force: true });
    const again = runTsc(args, fixture(import.meta.url, "lowering"));
    assert.doesNotMatch(again.output, /TSFILE/); // tsc trusts the build info and emits nothing
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(info, { recursive: true, force: true });
  }
});
