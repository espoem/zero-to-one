/**
 * Module 12 — runs the React and Solid type tests through the pinned tsc 7, so `npm test`
 * covers them too (they are .tsx files and cannot execute under Node type stripping).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runTsc } from "../utils/tsc.ts";

const here = path.dirname(new URL(import.meta.url).pathname);

test("React 19 typing tests compile (including every @ts-expect-error negative)", () => {
  const r = runTsc(["-p", "."], path.join(here, "react"));
  assert.equal(r.status, 0, r.output);
});

test("Solid 2.0 RC typing tests compile (including every @ts-expect-error negative)", () => {
  const r = runTsc(["-p", "."], path.join(here, "solid"));
  assert.equal(r.status, 0, r.output);
});

test("Solid 1.x jsxImportSource 'solid-js' no longer resolves a JSX runtime in 2.0 RC", () => {
  const r = runTsc(["-p", "."], path.join(here, "fixtures", "solid-old-jsx-source"));
  assert.notEqual(r.status, 0);
  assert.ok(r.codes.includes("TS2875"), r.output); // "requires the module path 'solid-js/jsx-runtime'"
});
