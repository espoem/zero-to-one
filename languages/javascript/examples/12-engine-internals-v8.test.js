// Module 12 · Engine internals (V8 14.6, Node 26.12.1)
// These assertions use V8-internal intrinsics and are pinned to the engine version in .mise.toml.
// They are deterministic (no timing), but expected to need updates when V8 changes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runNode } from './helpers/run-node.js';

/** Evaluate a snippet with natives syntax enabled; the snippet must assign `out`. */
function v8(src, extraFlags = []) {
  const r = runNode(['--allow-natives-syntax', ...extraFlags, '-e', `let out; ${src}; console.log(JSON.stringify(out));`]);
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').at(-1) ?? 'null');
}

// %GetOptimizationStatus bit for "optimized by TurboFan" in V8 14.6 (src/runtime/runtime.h, OptimizationStatus).
const TURBOFANNED = 1 << 5;

describe('Hidden classes (maps)', () => {
  test('objects built the same way share a map; property order matters', () => {
    const out = v8(`const a = { x: 1, y: 2 }, b = { x: 3, y: 4 }, c = { y: 1, x: 2 };
      out = [%HaveSameMap(a, b), %HaveSameMap(a, c)]`);
    assert.deepEqual(out, [true, false]);
  });

  test('instances of one class share a map; optional fields split it', () => {
    const out = v8(`class P { constructor(x, y) { this.x = x; this.y = y; } }
      const p = new P(1, 2), q = new P(3, 4);
      const r = new P(5, 6); r.z = 1;
      out = [%HaveSameMap(p, q), %HaveSameMap(p, r)]`);
    assert.deepEqual(out, [true, false]);
  });

  test('NEGATIVE: delete moves an object to dictionary mode (even the last-added property in V8 14.6)', () => {
    const out = v8(`const d = { x: 1, y: 2 }; const before = %HasFastProperties(d); delete d.x;
      const e = { x: 1, y: 2 }; delete e.y;
      const f = { x: 1, y: 2 }; f.x = undefined;
      out = [before, %HasFastProperties(d), %HasFastProperties(e), %HasFastProperties(f)]`);
    assert.deepEqual(out, [true, false, false, true]);
  });
});

describe('Elements kinds', () => {
  test('transitions are one-way: Smi → double → generic, never back', () => {
    const out = v8(`const arr = [1, 2, 3]; const s = %HasSmiElements(arr);
      arr.push(1.5); const d = %HasDoubleElements(arr);
      arr.push('s'); const o = %HasObjectElements(arr);
      arr.pop(); arr.pop();
      out = [s, d, o, %HasDoubleElements(arr), %HasObjectElements(arr)]`);
    assert.deepEqual(out, [true, true, true, false, true]);
  });

  test('NEGATIVE: holes come from elisions, new Array(n) and writes past the end', () => {
    const out = v8(`const packed = [1, 2, 3]; const elided = [1, , 3]; const sized = new Array(3);
      const grown = [1]; grown[5] = 1;
      const pushed = []; for (let i = 0; i < 3; i++) pushed.push(i);
      out = [%HasHoleyElements(packed), %HasHoleyElements(elided), %HasHoleyElements(sized),
             %HasHoleyElements(grown), %HasHoleyElements(pushed)]`);
    assert.deepEqual(out, [false, true, true, true, false]);
  });

  test('full-length fill and Array.from are packed; a partial fill stays holey (V8 14.6)', () => {
    const out = v8(`const partial = new Array(3); partial[0] = 1;
      out = [%HasHoleyElements(new Array(3).fill(0)), %HasHoleyElements(Array.from({ length: 3 }, () => 0)),
             %HasHoleyElements(partial)]`);
    assert.deepEqual(out, [false, false, true]);
  });

  test('-0 and NaN force double elements', () => {
    const out = v8(`const a = [1, 2]; a.push(-0); const b = [1]; b.push(NaN);
      out = [%HasDoubleElements(a), %HasDoubleElements(b)]`);
    assert.deepEqual(out, [true, true]);
  });
});

describe('Tiering and deoptimisation', () => {
  test('a type-stable function is optimised; a new type deoptimises it', () => {
    const out = v8(`function add(p, q) { return p + q; }
      %PrepareFunctionForOptimization(add); add(1, 2); add(3, 4);
      %OptimizeFunctionOnNextCall(add); add(5, 6);
      const optimized = (%GetOptimizationStatus(add) & ${TURBOFANNED}) !== 0;
      add('a', 'b');
      out = [optimized, (%GetOptimizationStatus(add) & ${TURBOFANNED}) !== 0]`);
    assert.deepEqual(out, [true, false]);
  });

  test('--trace-deopt reports the reason', () => {
    const r = runNode(['--allow-natives-syntax', '--trace-deopt', '-e', `function add(p, q) { return p + q; }
      %PrepareFunctionForOptimization(add); add(1, 2); add(3, 4);
      %OptimizeFunctionOnNextCall(add); add(5, 6); add('a', 'b');`]);
    assert.match(r.stdout + r.stderr, /reason: not a Smi/);
  });

  test('try/catch does not prevent optimisation (Crankshaft-era myth)', () => {
    const out = v8(`function safeDiv(a, b) { try { return a / b; } catch { return 0; } }
      %PrepareFunctionForOptimization(safeDiv); safeDiv(4, 2); safeDiv(9, 3);
      %OptimizeFunctionOnNextCall(safeDiv); safeDiv(8, 2);
      out = (%GetOptimizationStatus(safeDiv) & ${TURBOFANNED}) !== 0`);
    assert.equal(out, true);
  });
});

describe('Inline cache states (observable through shape variety)', () => {
  test('one factory → one map at the call site; ad-hoc literals → many maps', () => {
    const out = v8(`const make = (w, h) => ({ w, h });
      const fromFactory = [make(1, 2), make(3, 4), make(5, 6)];
      const adHoc = [{ w: 1, h: 2 }, { h: 2, w: 1 }, { w: 1, h: 2, c: 'r' }, { w: 1, h: 2, id: 7 }, { id: 1, w: 1, h: 2 }];
      const distinct = (objs) => { const reps = []; for (const o of objs) if (!reps.some((r) => %HaveSameMap(r, o))) reps.push(o); return reps.length; };
      out = [distinct(fromFactory), distinct(adHoc)]`);
    assert.deepEqual(out, [1, 5]); // 5 maps at one site exceeds the polymorphic limit (4): megamorphic
  });
});
