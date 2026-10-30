/**
 * Module 06 — Modules, declarations and tsconfig.
 * Fixture projects prove the resolution rules; the in-project code proves augmentation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { expectTypeOf } from "expect-type";
import { fixture, runTsc } from "../utils/tsc.ts";
import { emit } from "./event-registry.ts";

// --- Module augmentation: add entries to another module's interface -------------
declare module "./event-registry.ts" {
  interface EventRegistry {
    "user.created": { id: string };
    "order.paid": { orderId: string; cents: number };
  }
}

// --- Global augmentation: only allowed inside a module (this file has imports) ----
declare global {
  interface Window {
    __APP_VERSION__: string;
  }
  var __BUILD_ID__: string | undefined;
}

test("module augmentation makes emit() aware of events declared elsewhere", () => {
  assert.equal(emit("user.created", { id: "u1" }), 'user.created:{"id":"u1"}');
  // @ts-expect-error — payload does not match the registered event
  emit("order.paid", { orderId: "o1" });
  // @ts-expect-error — unknown event name
  emit("user.deleted", {});
});

test("declare global adds typed globals (types only: the runtime value may be absent)", () => {
  expectTypeOf(globalThis.__BUILD_ID__).toEqualTypeOf<string | undefined>();
  assert.equal(globalThis.__BUILD_ID__, undefined);
});

test("nodenext: extensions, type-only imports and JSON import attributes are enforced", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "nodenext-errors"));
  assert.deepEqual([...r.codes].sort(), ["TS1484", "TS1543", "TS2835"]);
});

test("nodenext: the fixed version (with #subpath imports) compiles", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "nodenext-fixed"));
  assert.equal(r.status, 0, r.output);
});

test("bundler resolution (module: preserve) accepts extensionless imports", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "bundler"));
  assert.equal(r.status, 0, r.output);
});

test("project references: a referenced project must be composite (TS6306)", () => {
  const r = runTsc(["-b", "app"], fixture(import.meta.url, "refs-broken"));
  assert.ok(r.codes.includes("TS6306"), r.output);
});

test("project references: tsc -b builds dependencies first, in parallel with --builders", () => {
  const dir = fixture(import.meta.url, "refs");
  for (const p of ["core", "app"]) {
    rmSync(path.join(dir, p, "dist"), { recursive: true, force: true });
    rmSync(path.join(dir, p, "tsconfig.tsbuildinfo"), { force: true });
  }
  const r = runTsc(["-b", "app", "--builders", "2", "--verbose"], dir);
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /core/);
});

test("exports: import vs require conditions pick different declarations; unexported subpaths fail", () => {
  const r = runTsc(["-p", "."], fixture(import.meta.url, "exports-conditions"));
  // consumer.mts gets "esm", consumer.cts gets "cjs" (no errors there); only the deep import fails.
  assert.deepEqual(r.codes, ["TS2307"]);
  assert.match(r.output, /zto-self\/src\/internal\.js/);
});

test("customConditions add a condition that wins over later ones (here: \"source\")", () => {
  const r = runTsc(["-p", ".", "--customConditions", "source"], fixture(import.meta.url, "exports-conditions"));
  assert.deepEqual([...r.codes].sort(), ["TS2307", "TS2322"]); // pub now comes from src/public.ts (type 2)
});

test("moduleDetection: a script's top-level const collides with lib.dom globals (TS2451)", () => {
  const dir = fixture(import.meta.url, "module-detection");
  const script = runTsc(["-p", "."], dir);
  assert.ok(script.codes.includes("TS2451"), script.output);
  const forced = runTsc(["-p", ".", "--moduleDetection", "force"], dir);
  assert.equal(forced.status, 0, forced.output);
});

test("--traceResolution explains how a specifier was resolved", () => {
  const r = runTsc(["-p", ".", "--traceResolution"], fixture(import.meta.url, "exports-conditions"));
  assert.match(r.output, /Resolving module 'zto-self' from/);
  assert.match(r.output, /import/);
});

test("paths aliases type-check but do not exist at runtime (Node ignores tsconfig)", () => {
  const dir = fixture(import.meta.url, "paths-alias");
  const checked = runTsc(["-p", "."], dir);
  assert.equal(checked.status, 0, checked.output);
  const run = spawnSync(process.execPath, [path.join(dir, "src", "main.ts")], { encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /ERR_MODULE_NOT_FOUND|Cannot find package '@lib/);
});
