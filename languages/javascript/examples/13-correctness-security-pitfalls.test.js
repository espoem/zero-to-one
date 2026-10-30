// Module 13 · Correctness and security pitfalls
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fc from 'fast-check';
import { runNode } from './helpers/run-node.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Safe deep merge: own keys only, dangerous keys skipped, null-prototype intermediate objects. */
export function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const value = source[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const next = Object.hasOwn(target, key) && typeof target[key] === 'object' && target[key] !== null
        ? target[key] : Object.create(null);
      target[key] = safeMerge(next, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/** Fisher–Yates shuffle with an injectable random source. */
export function shuffle(arr, random = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('Prototype pollution', () => {
  test('NEGATIVE: a naive merge of parsed JSON pollutes Object.prototype (child process)', () => {
    const src = `
      function naiveMerge(t, s) {
        for (const k in s) {
          if (typeof s[k] === 'object' && s[k] !== null) { t[k] ??= {}; naiveMerge(t[k], s[k]); }
          else t[k] = s[k];
        }
        return t;
      }
      naiveMerge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'));
      console.log(JSON.stringify([({}).isAdmin, Object.hasOwn({}, 'isAdmin')]));`;
    assert.deepEqual(JSON.parse(runNode(['-e', src]).stdout), [true, false]);
  });

  test('JSON.parse creates an own "__proto__" data property, not a prototype change', () => {
    const parsed = JSON.parse('{"__proto__": {"x": 1}}');
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
    assert.equal(Object.hasOwn(parsed, '__proto__'), true);
  });

  test('safeMerge skips dangerous keys and leaves Object.prototype untouched', () => {
    const result = safeMerge({}, JSON.parse('{"__proto__": {"isAdmin": true}, "constructor": {"prototype": {"x": 1}}, "ok": {"n": 1}}'));
    assert.equal(/** @type {any} */ ({}).isAdmin, undefined);
    assert.equal(/** @type {any} */ ({}).x, undefined);
    assert.deepEqual(Object.keys(result), ['ok']);
    assert.equal(result.ok.n, 1);
  });

  test('property: safeMerge never changes Object.prototype for arbitrary JSON input', () => {
    const before = Reflect.ownKeys(Object.prototype).length;
    fc.assert(fc.property(fc.json(), (text) => {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) safeMerge({}, parsed);
      return Reflect.ownKeys(Object.prototype).length === before;
    }));
  });

  test('--disable-proto=throw removes the accessor (defence in depth)', () => {
    const r = runNode(['--disable-proto=throw', '-e', '({}).__proto__']);
    assert.notEqual(r.status, 0);
  });
});

describe('ReDoS', () => {
  const evilInput = `"${'a'.repeat(40)}!"`;

  test('NEGATIVE: nested quantifiers on a non-matching input do not finish (killed after 3 s)', () => {
    // ~2^40 backtracking steps: no machine finishes this within the budget, so the outcome is deterministic.
    const r = spawnSync(process.execPath, ['-e', `/(a+)+$/.test(${evilInput})`], { timeout: 3000 });
    assert.equal(r.status, null);
    assert.equal(r.signal, 'SIGTERM');
  });

  test('the equivalent unambiguous pattern is linear', () => {
    assert.equal(/a+$/.test('a'.repeat(40) + '!'), false);
    assert.equal(/a+$/.test('a'.repeat(1e6)), true);
  });

  test("V8's experimental linear engine (l flag) runs the evil pattern instantly but rejects backreferences", () => {
    const ok = runNode(['--enable-experimental-regexp-engine', '-p', `/(a+)+$/l.test(${evilInput})`]);
    assert.equal(ok.stdout.trim(), 'false');
    const bad = runNode(['--enable-experimental-regexp-engine', '-e', 'new RegExp("(a)\\\\1", "l")']);
    assert.match(bad.stderr, /SyntaxError/);
  });

  test('RegExp.escape (ES2025) neutralises user text inside patterns', () => {
    const user = 'a.b*c';
    assert.equal(new RegExp(RegExp.escape(user)).test('axbbbc'), false);
    assert.equal(new RegExp(RegExp.escape(user)).test('a.b*c'), true);
    assert.equal(new RegExp(user).test('axbbbc'), true); // unescaped: metacharacters interpreted
  });

  test('NEGATIVE: a shared g regex is stateful (lastIndex)', () => {
    const re = /a/g;
    assert.deepEqual([re.test('a'), re.test('a'), re.test('a')], [true, false, true]);
    const fresh = /a/;
    assert.deepEqual([fresh.test('a'), fresh.test('a')], [true, true]);
  });

  test('the v flag: set subtraction and emoji string properties', () => {
    assert.equal(/[\p{L}--[a-z]]/v.test('a'), false);
    assert.equal(/[\p{L}--[a-z]]/v.test('Á'), true);
    assert.equal(/^\p{RGI_Emoji}$/v.test('\u{1F44D}\u{1F3FD}'), true);
    assert.equal(/^.$/.test('\u{1F600}'), false);      // without u/v, . is one code unit
    assert.equal(/^.$/u.test('\u{1F600}'), true);
  });
});

describe('JSON and big integers (ES2026)', () => {
  const text = '{"id":12345678901234567890,"n":1}';

  test('NEGATIVE: plain JSON.parse loses precision above 2^53', () => {
    assert.equal(JSON.parse(text).id, 12345678901234567000);
  });

  test('reviver context.source preserves the exact digits', () => {
    const data = JSON.parse(text, (key, value, ctx) =>
      typeof value === 'number' && !Number.isSafeInteger(value) ? BigInt(ctx.source) : value);
    assert.equal(data.id, 12345678901234567890n);
    assert.equal(data.n, 1);
  });

  test('JSON.rawJSON serialises BigInt losslessly and rejects non-primitives', () => {
    const replacer = (_k, v) => (typeof v === 'bigint' ? JSON.rawJSON(v.toString()) : v);
    assert.equal(JSON.stringify({ id: 12345678901234567890n }, replacer), '{"id":12345678901234567890}');
    assert.throws(() => JSON.rawJSON('{}'), SyntaxError);
    assert.throws(() => JSON.rawJSON(' 1'), SyntaxError);
  });

  test('property: BigInt round-trip through JSON with rawJSON and context.source', () => {
    fc.assert(fc.property(fc.bigInt({ min: -(2n ** 70n), max: 2n ** 70n }), (big) => {
      const s = JSON.stringify({ v: big }, (_k, v) => (typeof v === 'bigint' ? JSON.rawJSON(v.toString()) : v));
      const back = JSON.parse(s, (k, v, ctx) => (k === 'v' ? BigInt(ctx.source) : v));
      return back.v === big;
    }));
  });

  test('NEGATIVE: JSON drops or rewrites non-JSON values silently', () => {
    assert.equal(JSON.stringify({ a: undefined, b: () => 1, c: NaN, d: [undefined, Infinity] }), '{"c":null,"d":[null,null]}');
    assert.deepEqual(JSON.parse('{"k":1,"k":2}'), { k: 2 });
  });
});

describe('Floating point money and dates', () => {
  test('NEGATIVE: toFixed rounds the binary value', () => {
    assert.equal((1.005).toFixed(2), '1.00');
    assert.equal((1.0051).toFixed(2), '1.01');
  });

  test('integer minor units with Intl formatting', () => {
    const cents = [1999, 1, 1];
    const total = cents.reduce((a, b) => a + b, 0);
    assert.equal(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total / 100), '$20.01');
  });

  test('NEGATIVE: V8 accepts 30 February and rolls it over; Temporal can reject it', () => {
    assert.equal(new Date('2026-02-30').toISOString(), '2026-03-02T00:00:00.000Z');
    assert.throws(() => Temporal.PlainDate.from('2026-02-30', { overflow: 'reject' }), RangeError);
  });
});

describe('Sorting', () => {
  test('NEGATIVE: the default comparator compares strings', () => {
    assert.deepEqual([10, 1, 2].sort(), [1, 10, 2]);
    assert.deepEqual([10, 1, 2].sort((a, b) => a - b), [1, 2, 10]);
  });

  test('NEGATIVE: a boolean comparator is inconsistent (V8 14.6 leaves this input unsorted)', () => {
    assert.deepEqual([3, 1, 2].sort((a, b) => /** @type {any} */ (a > b)), [3, 1, 2]);
  });

  test('property: sort is stable (ES2019)', () => {
    fc.assert(fc.property(fc.array(fc.record({ k: fc.integer({ min: 0, max: 3 }), i: fc.nat() })), (xs) => {
      const tagged = xs.map((x, idx) => ({ ...x, idx }));
      const sorted = tagged.toSorted((a, b) => a.k - b.k);
      return sorted.every((x, j) => j === 0 || sorted[j - 1].k < x.k || sorted[j - 1].idx < x.idx);
    }));
  });

  test('undefined and holes go last without calling the comparator', () => {
    const seen = [];
    const out = [3, undefined, 1, , 2].sort((a, b) => { seen.push(a, b); return a - b; });
    assert.deepEqual(out.slice(0, 4), [1, 2, 3, undefined]);
    assert.equal(4 in out, false);
    assert.ok(seen.every((v) => v !== undefined));
  });

  test('toSorted does not mutate; sort does', () => {
    const a = [3, 1, 2];
    const b = a.toSorted();
    assert.deepEqual(a, [3, 1, 2]);
    assert.deepEqual(b, [1, 2, 3]);
    assert.equal(a.sort(), a);
  });

  test('property: Fisher–Yates is a permutation', () => {
    fc.assert(fc.property(fc.array(fc.integer()), fc.infiniteStream(fc.double({ min: 0, max: 0.999999, noNaN: true })), (xs, rnd) => {
      const shuffled = shuffle(xs, () => rnd.next().value);
      return JSON.stringify(shuffled.toSorted((a, b) => a - b)) === JSON.stringify(xs.toSorted((a, b) => a - b));
    }));
  });
});
