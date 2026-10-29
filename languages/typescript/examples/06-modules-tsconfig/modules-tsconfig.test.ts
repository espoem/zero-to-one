/**
 * Module 06 — Modules, declarations and tsconfig.
 * Fixture projects prove the resolution rules; the in-project code proves augmentation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
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
