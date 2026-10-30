// Module 02 · Types, values and coercion
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { runNode } from './helpers/run-node.js';

/** Neumaier compensated summation (see the pseudocode in module 02). */
export function neumaierSum(xs) {
  let s = 0;
  let c = 0;
  for (const x of xs) {
    const t = s + x;
    if (Math.abs(s) >= Math.abs(x)) c += (s - t) + x;
    else c += (x - t) + s;
    s = t;
  }
  return s + c;
}

describe('typeof (§13.5.3)', () => {
  test('the table, including the two historic special cases', () => {
    assert.equal(typeof undefined, 'undefined');
    assert.equal(typeof null, 'object');          // historic bug, kept forever
    assert.equal(typeof (() => {}), 'function');  // objects with [[Call]]
    assert.equal(typeof class {}, 'function');
    assert.equal(typeof 1n, 'bigint');
    assert.equal(typeof Symbol(), 'symbol');
    assert.equal(typeof [], 'object');            // use Array.isArray
    assert.equal(Array.isArray(new Proxy([], {})), true);
  });

  test('wrapper objects are truthy and are objects', () => {
    assert.equal(typeof new String('a'), 'object');
    assert.equal(Boolean(new Boolean(false)), true);
  });

  test('NEGATIVE: assigning a property to a primitive throws in strict code', () => {
    assert.throws(() => { const s = 'abc'; s.custom = 1; }, TypeError);
  });
});

describe('Number: IEEE 754 binary64 (§6.1.6.1)', () => {
  test('the classic representability facts', () => {
    assert.notEqual(0.1 + 0.2, 0.3);
    assert.equal(0.1 + 0.2, 0.30000000000000004);
    assert.equal(2 ** 53 + 1, 2 ** 53);
    assert.equal(Number.MAX_SAFE_INTEGER, 2 ** 53 - 1);
    assert.equal(Number.EPSILON, 2 ** -52);
    assert.equal(Number.isInteger(2 ** 60), true);
    assert.equal(Number.isSafeInteger(2 ** 60), false);
  });

  test('NaN and signed zero', () => {
    assert.equal(NaN === NaN, false);
    assert.equal(Object.is(NaN, NaN), true);
    assert.equal(0 === -0, true);
    assert.equal(Object.is(0, -0), false);
    assert.equal(1 / -0, -Infinity);
    assert.ok(Object.is(Math.round(-0.4), -0));
    assert.equal(String(-0), '0');           // the sign is lost in text
    assert.equal(JSON.stringify(-0), '0');
  });

  test('NEGATIVE: global isNaN coerces, Number.isNaN does not', () => {
    assert.equal(isNaN('abc'), true);
    assert.equal(Number.isNaN('abc'), false);
  });

  test('property: shortest round-trip, Number(String(x)) === x for all finite doubles', () => {
    fc.assert(fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
      return Object.is(Number(String(x)), x) || (x === 0); // String(-0) is "0"
    }));
  });

  test('Neumaier summation fixes catastrophic cancellation where reduce fails', () => {
    const xs = [1e20, 0.1, -1e20];
    assert.equal(xs.reduce((a, b) => a + b, 0), 0);  // naive: the 0.1 is lost
    assert.equal(neumaierSum(xs), 0.1);
  });

  test('Math.sumPrecise (ES2026) agrees with Neumaier, but only behind a flag in Node 26', () => {
    assert.equal(typeof Math.sumPrecise, 'undefined');
    const r = runNode(['--js-sum-precise', '-p',
      'JSON.stringify([Math.sumPrecise([1e20, 0.1, -1e20]), Object.is(Math.sumPrecise([]), -0)])']);
    assert.deepEqual(JSON.parse(r.stdout), [0.1, true]);
  });

  test('NEGATIVE: Math.sumPrecise refuses to coerce', () => {
    const r = runNode(['--js-sum-precise', '-e', 'Math.sumPrecise(["1"])']);
    assert.match(r.stderr, /TypeError/);
  });
});

describe('BigInt (§6.1.6.2)', () => {
  test('NEGATIVE: arithmetic does not mix BigInt and Number', () => {
    assert.throws(() => 1n + /** @type {any} */ (1), TypeError);
    assert.throws(() => +(/** @type {any} */ (1n)), TypeError);   // unary plus
    assert.throws(() => 1n >>> 0n, TypeError);                   // no unsigned shift
  });

  test('comparisons across BigInt and Number are exact', () => {
    assert.equal(1n < 2, true);
    assert.equal(2n == 2, true);
    assert.equal(2n === /** @type {any} */ (2), false);
    assert.equal(2n == 2.5, false);
  });

  test('division truncates toward zero; conversions are strict', () => {
    assert.equal(7n / 2n, 3n);
    assert.equal(-7n / 2n, -3n);
    assert.equal(BigInt('0x10'), 16n);
    assert.throws(() => BigInt(1.5), RangeError);
    assert.throws(() => BigInt('1.0'), SyntaxError);
    assert.equal(BigInt.asIntN(8, 255n), -1n);
  });

  test('NEGATIVE: JSON.stringify throws on BigInt', () => {
    assert.throws(() => JSON.stringify({ n: 1n }), TypeError);
  });
});

describe('String: UTF-16 code units (§6.1.4)', () => {
  test('length counts code units, iteration counts code points, Segmenter counts graphemes', () => {
    const s = '\u{1F44D}\u{1F3FD}'; // thumbs up + skin tone modifier
    assert.equal(s.length, 4);
    assert.equal([...s].length, 2);
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
    assert.equal([...seg.segment(s)].length, 1);
  });

  test('NEGATIVE: slicing through a surrogate pair produces an ill-formed string', () => {
    const cut = '\u{1F600}'.slice(0, 1);
    assert.equal(cut.isWellFormed(), false);
    assert.throws(() => encodeURIComponent(cut), URIError);
    assert.equal(cut.toWellFormed(), '�');
  });

  test('< compares code units, not code points or locale', () => {
    assert.equal('Z' < 'a', true);
    assert.equal('～' > '\u{1F600}', true);
    assert.equal(['b', 'a', 'B'].sort().join(''), 'Bab'); // code units: 'B' (0x42) < 'a' (0x61)
    assert.equal(['b', 'a', 'B'].sort((x, y) => x.localeCompare(y, 'en')).join(''), 'abB'); // ICU: lower case sorts before upper case at the tertiary level
  });
});

describe('Symbols (§6.1.5)', () => {
  test('unique, registry-shared, and not private', () => {
    assert.notEqual(Symbol('x'), Symbol('x'));
    assert.equal(Symbol.for('x'), Symbol.for('x'));
    const k = Symbol('k');
    const o = { [k]: 1 };
    assert.deepEqual(Reflect.ownKeys(o), [k]);
  });

  test('NEGATIVE: implicit string conversion of a Symbol throws; String(sym) works', () => {
    const sym = Symbol('desc');
    assert.throws(() => `${/** @type {any} */ (sym)}`, TypeError);
    assert.equal(String(sym), 'Symbol(desc)');
    assert.equal(sym.description, 'desc');
  });
});

describe('ToPrimitive and hints (§7.1.1)', () => {
  const recordHints = () => {
    const hints = [];
    const obj = { [Symbol.toPrimitive](hint) { hints.push(hint); return hint === 'string' ? 'S' : 42; } };
    return { obj, hints };
  };

  test('each operator passes the documented hint', () => {
    const { obj, hints } = recordHints();
    const o = /** @type {any} */ (obj);
    void (o + '');     // default
    void (o * 2);      // number
    void `${o}`;       // string
    void (o == 42);    // default
    void (o < 100);    // number
    void String(o);    // string
    assert.deepEqual(hints, ['default', 'number', 'string', 'default', 'number', 'string']);
  });

  test('OrdinaryToPrimitive tries valueOf first for number/default, toString first for string', () => {
    const calls = [];
    const o = /** @type {any} */ ({
      valueOf() { calls.push('valueOf'); return {}; },  // not primitive: fall through
      toString() { calls.push('toString'); return '7'; },
    });
    assert.equal(o * 1, 7);
    assert.deepEqual(calls, ['valueOf', 'toString']);
  });

  test('Date treats the default hint as string', () => {
    const d = /** @type {any} */ (new Date(0));
    assert.equal(typeof (d + 1), 'string');
    assert.equal(d - 1, -1);
  });

  test('NEGATIVE: @@toPrimitive returning an object throws TypeError', () => {
    const bad = /** @type {any} */ ({ [Symbol.toPrimitive]() { return {}; } });
    assert.throws(() => bad + 1, TypeError);
  });
});

describe('ToBoolean, ToNumber, ToString, ToPropertyKey, ToInt32', () => {
  test('exactly these primitives are falsy', () => {
    for (const v of [false, 0, -0, 0n, NaN, '', null, undefined]) assert.equal(Boolean(v), false);
    for (const v of ['0', 'false', [], {}, -1n, ' ']) assert.equal(Boolean(v), true);
  });

  test('StringToNumber rules', () => {
    assert.equal(Number(''), 0);
    assert.equal(Number('  12\n'), 12);
    assert.equal(Number('0x1F'), 31);
    assert.equal(Number('0b11'), 3);
    assert.equal(Number('Infinity'), Infinity);
    assert.ok(Number.isNaN(Number('1_000')));    // separators are literal-only
    assert.ok(Number.isNaN(Number('12px')));
    assert.equal(Number(null), 0);
    assert.ok(Number.isNaN(Number(undefined)));
    assert.equal(Number([]), 0);
    assert.equal(Number([7]), 7);
    assert.ok(Number.isNaN(Number([1, 2])));
  });

  test('NEGATIVE: parseInt parses a prefix of the *string* form', () => {
    assert.equal(parseInt('12px', 10), 12);
    assert.equal(parseInt(/** @type {any} */ (0.0000005), 10), 5);  // "5e-7"
    assert.ok(Number.isNaN(parseInt('', 10)));
  });

  test('ToString of arrays and special numbers', () => {
    assert.equal(String([1, [2, 3]]), '1,2,3');
    assert.equal(String([null, undefined]), ',');
    assert.equal(String(1e21), '1e+21');
  });

  test('NEGATIVE: ToPropertyKey collapses object keys to "[object Object]"', () => {
    const cache = {};
    const a = {}; const b = {};
    cache[/** @type {any} */ (a)] = 'A';
    cache[/** @type {any} */ (b)] = 'B';
    assert.deepEqual(Object.keys(cache), ['[object Object]']);
    assert.equal(cache[/** @type {any} */ (a)], 'B');  // collision
    const m = new Map([[a, 'A'], [b, 'B']]);
    assert.equal(m.get(a), 'A');
  });

  test('NEGATIVE: x | 0 is ToInt32, not floor', () => {
    assert.equal((2 ** 32 + 5) | 0, 5);
    assert.equal((2 ** 31) | 0, -2147483648);
    assert.equal(-1.5 | 0, -1);
    assert.equal(Math.floor(-1.5), -2);
  });

  test('property: ToInt32 equals the spec formula (modulo 2^32 into the signed range)', () => {
    const toInt32 = (x) => {
      if (!Number.isFinite(x)) return 0;
      const int = Math.trunc(x);
      const m = ((int % 2 ** 32) + 2 ** 32) % 2 ** 32;
      return m >= 2 ** 31 ? m - 2 ** 32 : m;
    };
    fc.assert(fc.property(fc.integer({ min: -(2 ** 52), max: 2 ** 52 }), (n) => (n | 0) === toInt32(n)));
  });
});

describe('Equality algorithms (§7.2.9, §7.2.10, §7.2.13, §7.2.14)', () => {
  test('which API uses which algorithm', () => {
    assert.equal([NaN].indexOf(NaN), -1);        // IsStrictlyEqual
    assert.equal([NaN].includes(NaN), true);     // SameValueZero
    assert.equal(new Set([0, -0]).size, 1);      // SameValueZero
    assert.equal(new Map([[NaN, 1]]).get(NaN), 1);
    assert.equal(Object.is(0, -0), false);       // SameValue
  });

  test('IsLooselyEqual step by step', () => {
    const eq = (a, b) => /** @type {any} */ (a) == /** @type {any} */ (b);
    assert.equal(eq(null, undefined), true);
    assert.equal(eq(null, 0), false);
    assert.equal(eq(true, '1'), true);
    assert.equal(eq([], false), true);
    assert.equal(eq([], ![]), true);
    assert.equal(eq('1', 1n), true);
    assert.equal(eq('x', 1n), false);           // unparsable → false
    assert.equal(eq({ valueOf: () => 3 }, 3), true);
  });

  test('NEGATIVE: == is not transitive', () => {
    const eq = (a, b) => /** @type {any} */ (a) == /** @type {any} */ (b);
    assert.equal(eq('0', 0), true);
    assert.equal(eq(0, ''), true);
    assert.equal(eq('0', ''), false);
  });

  test('property: SameValue is an equivalence relation (reflexive even for NaN)', () => {
    fc.assert(fc.property(fc.anything(), (x) => Object.is(x, x)));
  });

  test('property: === is reflexive for every value except NaN', () => {
    fc.assert(fc.property(fc.anything(), (x) => (x === x) !== Number.isNaN(x)));
  });

  test('relational comparison with null', () => {
    const n = /** @type {any} */ (null);
    assert.equal(n >= 0, true);
    assert.equal(n > 0, false);
    assert.equal(n == 0, false);
    assert.equal(NaN <= NaN, false);
  });
});

describe('The + operator (§13.15.3)', () => {
  test('string wins, otherwise numeric, left associative', () => {
    const any = (v) => /** @type {any} */ (v);
    assert.equal(1 + any('2'), '12');
    assert.equal(any('3') - 1, 2);
    assert.equal(1 + any(null), 1);
    assert.ok(Number.isNaN(1 + any(undefined)));
    assert.equal(any([1, 2]) + any([3]), '1,23');
    assert.equal(any(true) + any(true), 2);
    assert.equal(1 + 2 + any('3'), '33');
    assert.equal(any('1') + 2 + 3, '123');
  });

  test('`??` keeps falsy-but-valid values that `||` overwrites', () => {
    const count = 0;
    assert.equal(count || 10, 10);
    assert.equal(count ?? 10, 0);
  });
});
