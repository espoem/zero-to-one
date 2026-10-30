// Verification script for the hands-on tasks (H1–H6) in exams/interview.md.
// By default it checks the reference solutions; set SOLUTIONS to check your own file.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const S = await import(process.env.SOLUTIONS ?? './exam-solutions.js');

describe('H1 · promiseAll', () => {
  test('input order, non-promises, empty input', async () => {
    assert.deepEqual(await S.promiseAll([delay(10, 'a'), 'b', Promise.resolve('c')]), ['a', 'b', 'c']);
    assert.deepEqual(await S.promiseAll([]), []);
    assert.deepEqual(await S.promiseAll(new Set([1, 2])), [1, 2]);
  });
  test('rejects with the first rejection', async () => {
    await assert.rejects(S.promiseAll([delay(20).then(() => { throw new Error('late'); }), Promise.reject(new Error('first'))]), /first/);
  });
});

describe('H2 · mapWithConcurrency', () => {
  test('bounded concurrency and ordered results', async () => {
    let inFlight = 0; let peak = 0;
    const out = await S.mapWithConcurrency([3, 1, 2, 1, 1], 2, async (ms, i) => {
      inFlight++; peak = Math.max(peak, inFlight); await delay(ms); inFlight--; return i * 10;
    });
    assert.equal(peak, 2);
    assert.deepEqual(out, [0, 10, 20, 30, 40]);
  });
  test('rejects when a task fails', async () => {
    await assert.rejects(S.mapWithConcurrency([1, 2, 3], 2, async (x) => { if (x === 2) throw new Error('t2'); return x; }), /t2/);
  });
});

describe('H3 · debounce (fake clock)', () => {
  test('trailing call with the latest arguments', () => {
    let now = 0; let timers = []; let id = 0;
    const clock = {
      setTimeout(fn, ms) { const h = ++id; timers.push({ h, at: now + ms, fn }); return h; },
      clearTimeout(h) { timers = timers.filter((t) => t.h !== h); },
      now: () => now,
    };
    const advance = (ms) => { now += ms; const due = timers.filter((t) => t.at <= now); timers = timers.filter((t) => t.at > now); due.forEach((t) => t.fn()); };
    const calls = [];
    const d = S.debounce((x) => calls.push(x), 50, clock);
    d(1); advance(30); d(2); advance(49);
    assert.deepEqual(calls, []);
    advance(1);
    assert.deepEqual(calls, [2]);
  });
});

describe('H4 · myBind', () => {
  test('this, partial application, name, length', () => {
    function f(a, b, c) { return [this?.id, a, b, c]; }
    const b = S.myBind(f, { id: 1 }, 'a');
    assert.deepEqual(b('b', 'c'), [1, 'a', 'b', 'c']);
    assert.equal(b.name, 'bound f');
    assert.equal(b.length, 2);
  });
  test('new ignores the bound this', () => {
    function P(x, y) { this.x = x; this.y = y; }
    const BP = S.myBind(P, { ignored: true }, 1);
    const p = new BP(2);
    assert.deepEqual([p.x, p.y], [1, 2]);
    assert.ok(p instanceof P);
  });
});

describe('H5 · deepClone', () => {
  test('cycles, shared references, Map, Set, Date, prototypes', () => {
    class Point { constructor(x) { this.x = x; } }
    const shared = { s: 1 };
    const src = { a: shared, b: shared, m: new Map([[1, new Set([shared])]]), d: new Date(0), p: new Point(3) };
    src.self = src;
    const c = S.deepClone(src);
    assert.notEqual(c, src);
    assert.equal(c.self, c);
    assert.equal(c.a, c.b);
    assert.notEqual(c.a, shared);
    assert.equal([...c.m.get(1)][0], c.a);
    assert.ok(c.d instanceof Date && c.d !== src.d && c.d.getTime() === 0);
    assert.ok(c.p instanceof Point);
  });
});

describe('H6 · createSignal (microtask batching)', () => {
  test('batches synchronous sets into one notification; ignores equal values', async () => {
    const s = S.createSignal(0);
    const seen = [];
    s.subscribe((v) => seen.push(v));
    s.set(1); s.set(2); s.set(3);
    assert.deepEqual(seen, []);          // not synchronous
    await null;
    assert.deepEqual(seen, [3]);         // one flush with the latest value
    s.set(3);
    await null;
    assert.deepEqual(seen, [3]);         // SameValue: no notification
    s.set(NaN); await null; s.set(NaN); await null;
    assert.equal(seen.length, 2);        // NaN equals NaN under SameValue
  });
});
