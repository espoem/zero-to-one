// Module 04 · Objects, prototypes and classes
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fc from 'fast-check';

/** `new`, implemented for base (non-class) constructors. */
export function myNew(F, ...args) {
  const proto = Object(F.prototype) === F.prototype ? F.prototype : Object.prototype;
  const obj = Object.create(proto);
  const result = F.apply(obj, args);
  return Object(result) === result ? result : obj;
}

/** OrdinaryHasInstance, implemented. */
export function myInstanceof(v, Target) {
  if (typeof Target[Symbol.hasInstance] === 'function' && Target[Symbol.hasInstance] !== Function.prototype[Symbol.hasInstance]) {
    return Boolean(Target[Symbol.hasInstance](v));
  }
  if (Object(v) !== v) return false;
  const proto = Target.prototype;
  for (let p = Object.getPrototypeOf(v); p !== null; p = Object.getPrototypeOf(p)) {
    if (p === proto) return true;
  }
  return false;
}

describe('Property descriptors (§6.2.6)', () => {
  test('defaults differ between assignment and defineProperty', () => {
    const o = {};
    o.a = 1;
    Object.defineProperty(o, 'b', { value: 2 });
    assert.deepEqual(Object.getOwnPropertyDescriptor(o, 'a'), { value: 1, writable: true, enumerable: true, configurable: true });
    assert.deepEqual(Object.getOwnPropertyDescriptor(o, 'b'), { value: 2, writable: false, enumerable: false, configurable: false });
    assert.deepEqual(Object.keys(o), ['a']);
  });

  test('class methods are non-enumerable, class fields are enumerable', () => {
    class C { f = 1; m() {} }
    assert.equal(Object.getOwnPropertyDescriptor(C.prototype, 'm')?.enumerable, false);
    assert.equal(Object.getOwnPropertyDescriptor(new C(), 'f')?.enumerable, true);
  });

  test('NEGATIVE: non-configurable properties reject redefinition except writable true→false', () => {
    const o = {};
    Object.defineProperty(o, 'x', { value: 1, writable: true, configurable: false });
    Object.defineProperty(o, 'x', { value: 2 });           // allowed: still writable
    Object.defineProperty(o, 'x', { writable: false });    // allowed: true → false
    assert.throws(() => Object.defineProperty(o, 'x', { writable: true }), TypeError);
    assert.throws(() => Object.defineProperty(o, 'x', { get() { return 1; } }), TypeError);
    assert.throws(() => { delete /** @type {any} */ (o).x; }, TypeError);
  });

  test('NEGATIVE: Object.freeze is shallow and ignores internal slots', () => {
    const o = Object.freeze({ nested: { n: 1 }, m: new Map(), d: new Date(0) });
    o.nested.n = 2;
    o.m.set('k', 'v');
    o.d.setTime(5);
    assert.equal(o.nested.n, 2);
    assert.equal(o.m.get('k'), 'v');
    assert.equal(o.d.getTime(), 5);
    assert.throws(() => { /** @type {any} */ (o).added = 1; }, TypeError);
  });
});

describe('[[Get]] and [[Set]] (§10.1.8, §10.1.9)', () => {
  test('inherited getters run with the receiver as this', () => {
    const proto = { get who() { return this.name; } };
    const o = Object.create(proto);
    o.name = 'instance';
    assert.equal(o.who, 'instance');
  });

  test('inherited setters intercept assignment; no own property is created', () => {
    const log = [];
    const proto = { set x(v) { log.push(v); } };
    const o = Object.create(proto);
    o.x = 1;
    assert.deepEqual(log, [1]);
    assert.equal(Object.hasOwn(o, 'x'), false);
  });

  test('NEGATIVE: the override mistake, an inherited read-only property blocks assignment', () => {
    const proto = Object.freeze({ toString() { return 'proto'; } });
    const o = Object.create(proto);
    assert.throws(() => { o.toString = () => 'own'; }, TypeError);
    Object.defineProperty(o, 'toString', { value: () => 'own' }); // definition works
    assert.equal(String(o), 'own');
  });

  test('Object.assign uses [[Set]] (setters run); spread uses define (no setters)', () => {
    const log = [];
    const target = { set v(x) { log.push(x); } };
    Object.assign(target, { v: 1 });
    assert.deepEqual(log, [1]);
    const spread = { ...{ v: 2 } };
    assert.equal(spread.v, 2);
  });
});

describe('Own property key order (§10.1.11.1)', () => {
  test('integer keys ascending, then strings by insertion, then symbols by insertion', () => {
    const s1 = Symbol('s1');
    const o = { b: 1, 2: 1, [s1]: 1, a: 1, 1: 1, '-1': 1, '01': 1 };
    assert.deepEqual(Object.keys(o), ['1', '2', 'b', 'a', '-1', '01']);
    assert.deepEqual(Reflect.ownKeys(o), ['1', '2', 'b', 'a', '-1', '01', s1]);
    assert.equal(JSON.stringify({ z: 1, 10: 1, 9: 1 }), '{"9":1,"10":1,"z":1}');
  });

  test('property: Object.keys always lists canonical array-index keys first, ascending', () => {
    fc.assert(fc.property(fc.array(fc.oneof(fc.nat({ max: 1000 }).map(String), fc.string({ maxLength: 3 }))), (keys) => {
      const o = {};
      for (const k of keys) o[k] = true;
      const isIndex = (k) => String(Number(k) >>> 0) === k && Number(k) !== 2 ** 32 - 1;
      const ks = Object.keys(o);
      const idx = ks.filter(isIndex);
      const firstNonIndex = ks.findIndex((k) => !isIndex(k));
      const sorted = [...idx].sort((a, b) => Number(a) - Number(b));
      return JSON.stringify(idx) === JSON.stringify(sorted) &&
        (firstNonIndex === -1 || ks.slice(firstNonIndex).every((k) => !isIndex(k)));
    }));
  });
});

describe('Prototypes, new and instanceof', () => {
  test('myNew matches new for base constructors, including object return values', () => {
    function P(x) { this.x = x; }
    P.prototype.get = function () { return this.x; };
    assert.equal(myNew(P, 3).get(), 3);
    assert.ok(myNew(P, 3) instanceof P);
    function Q() { return { replaced: true }; }
    assert.deepEqual(myNew(Q), { replaced: true });
    assert.deepEqual(new /** @type {any} */ (Q)(), { replaced: true });
  });

  test('myInstanceof matches instanceof, including Symbol.hasInstance', () => {
    class A {}
    class B extends A {}
    const b = new B();
    for (const T of [A, B, Object, Array]) assert.equal(myInstanceof(b, T), b instanceof T);
    const Even = { [Symbol.hasInstance]: (n) => n % 2 === 0 };
    assert.equal(myInstanceof(2, Even), true);
    assert.equal(/** @type {any} */ (2) instanceof /** @type {any} */ (Even), true);
  });

  test('NEGATIVE: instanceof fails across realms; Array.isArray and Error.isError do not', () => {
    const arr = vm.runInNewContext('[]');
    const err = vm.runInNewContext('new Error("x")');
    assert.equal(arr instanceof Array, false);
    assert.equal(Array.isArray(arr), true);
    assert.equal(err instanceof Error, false);
    assert.equal(Error.isError(err), true);
  });

  test('null-prototype dictionaries have no inherited keys and no __proto__ accessor', () => {
    const dict = Object.create(null);
    assert.equal('toString' in dict, false);
    dict['__proto__'] = 'just data';
    assert.equal(Object.keys(dict)[0], '__proto__');
    assert.equal(Object.getPrototypeOf(dict), null);
    assert.equal(Object.hasOwn(dict, '__proto__'), true);
  });

  test('__proto__ in a literal sets the prototype; a computed key does not', () => {
    const p = { inherited: true };
    const a = { __proto__: p };
    const b = { ['__proto__']: p };
    assert.equal(Object.getPrototypeOf(a), p);
    assert.equal(Object.getPrototypeOf(b), Object.prototype);
    assert.equal(Object.hasOwn(b, '__proto__'), true);
  });

  test('for...in includes inherited enumerable keys (as strings)', () => {
    const o = Object.create({ inherited: 1 });
    o.own = 1;
    const keys = [];
    for (const k in o) keys.push(k);
    assert.deepEqual(keys, ['own', 'inherited']);
  });
});

describe('Classes (§15.7)', () => {
  test('NEGATIVE: class constructors cannot be called without new', () => {
    class C {}
    assert.throws(() => /** @type {any} */ (C)(), TypeError);
  });

  test('NEGATIVE: classes are in the TDZ before their declaration', () => {
    assert.throws(() => new Function('new C(); class C {}')(), ReferenceError);
  });

  test('NEGATIVE: base constructor sees subclass fields as not yet defined', () => {
    class Base { constructor() { this.init(); } init() {} }
    class Derived extends Base {
      value = 'field';
      init() { this.seen = this.value; }
    }
    assert.equal(new Derived().seen, undefined);
  });

  test('NEGATIVE: a class field shadows an inherited setter (define semantics)', () => {
    const log = [];
    class Base { set v(x) { log.push(x); } }
    class Derived extends Base { v = 1; }
    const d = new Derived();
    assert.deepEqual(log, []);              // the setter never ran
    assert.equal(Object.hasOwn(d, 'v'), true);
  });

  test('subclassing Array produces a real Array exotic object', () => {
    class Stack extends Array { peek() { return this[this.length - 1]; } }
    const s = new Stack();
    s.push(1, 2);
    s[5] = 9;
    assert.equal(s.length, 6);
    assert.equal(Array.isArray(s), true);
    assert.equal(s.peek(), 9);
    assert.ok(s.map((x) => x) instanceof Stack);  // via Symbol.species
  });

  test('private names: brand checks and `#x in obj`', () => {
    class Point {
      #x;
      constructor(x) { this.#x = x; }
      static isPoint(o) { return #x in o; }
      static readX(o) { return o.#x; }
      equals(other) { return this.#x === other.#x; }
    }
    const p = new Point(1);
    assert.equal(Point.isPoint(p), true);
    assert.equal(Point.isPoint({}), false);
    assert.equal(p.equals(new Point(1)), true);
    assert.throws(() => Point.readX({}), TypeError);
    assert.deepEqual(Reflect.ownKeys(p), []);   // not a property
  });

  test('NEGATIVE: Proxy does not forward private names', () => {
    class Secret { #s = 42; reveal() { return this.#s; } }
    const proxied = new Proxy(new Secret(), {});
    assert.throws(() => proxied.reveal(), TypeError);
  });

  test('NEGATIVE: freezing an instance does not freeze private fields', () => {
    class Counter { #n = 0; inc() { return ++this.#n; } }
    const c = Object.freeze(new Counter());
    assert.equal(c.inc(), 1);
  });

  test('static blocks run once with this = the class, and can reach private state', () => {
    let peek;
    class Vault {
      static #items = [];
      static { this.#items.push('init'); peek = () => Vault.#items.length; }
      static add(x) { Vault.#items.push(x); }
    }
    Vault.add('a');
    assert.equal(peek(), 2);
  });

  test('static methods are inherited through the constructor chain', () => {
    class A { static create() { return new this(); } }
    class B extends A {}
    assert.ok(B.create() instanceof B);
    assert.equal(Object.getPrototypeOf(B), A);
  });
});

describe('Built-in exotic objects (§10.4)', () => {
  test('Array length invariant and non-index keys', () => {
    const a = [];
    a[10] = 1;
    assert.equal(a.length, 11);
    /** @type {any} */ (a)['1.0'] = 'x';
    /** @type {any} */ (a)[-1] = 'y';
    assert.equal(a.length, 11);
    a.length = 0;
    assert.equal(a[10], undefined);
    assert.equal(/** @type {any} */ (a)['1.0'], 'x');
  });

  test('NEGATIVE: methods disagree about holes', () => {
    const holey = [1, , 3];
    let calls = 0;
    holey.forEach(() => calls++);
    assert.equal(calls, 2);
    assert.deepEqual([...holey], [1, undefined, 3]);
    assert.equal(holey.indexOf(undefined), -1);
    assert.equal(holey.includes(undefined), true);
    assert.equal(1 in holey, false);
  });

  test('TypedArrays ignore out-of-bounds and non-integer numeric keys', () => {
    const ta = new Uint8Array(2);
    /** @type {any} */ (ta)[5] = 1;
    /** @type {any} */ (ta)[1.5] = 1;
    /** @type {any} */ (ta)['-0'] = 1;
    ta[0] = 257;                                   // modulo 256
    assert.deepEqual(Reflect.ownKeys(ta), ['0', '1']);
    assert.equal(ta[0], 1);
    assert.equal(new Uint8ClampedArray([300])[0], 255);
  });

  test('String exotic objects expose indices', () => {
    const s = new String('ab');
    assert.deepEqual(Object.keys(s), ['0', '1']);
    assert.equal(Object.getOwnPropertyDescriptor(s, 'length')?.writable, false);
  });
});

describe('Copying', () => {
  test('spread and structuredClone lose the prototype; structuredClone handles cycles', () => {
    class P { constructor() { this.x = 1; } m() {} }
    const p = new P();
    assert.equal(Object.getPrototypeOf({ ...p }), Object.prototype);
    const cyc = { name: 'c' };
    /** @type {any} */ (cyc).self = cyc;
    const clone = structuredClone(cyc);
    assert.equal(clone.self, clone);
    assert.notEqual(clone, cyc);
    assert.equal(Object.getPrototypeOf(structuredClone(p)), Object.prototype);
  });

  test('NEGATIVE: JSON round-trip loses types silently', () => {
    const src = { u: undefined, d: new Date(0), m: new Map([[1, 2]]), n: NaN };
    assert.deepEqual(JSON.parse(JSON.stringify(src)), { d: '1970-01-01T00:00:00.000Z', m: {}, n: null });
  });
});
