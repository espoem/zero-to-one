// Module 09 · Metaprogramming
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { runNode } from './helpers/run-node.js';

/** Minimal proxy-based reactive store (see module 09, section 1). */
export function createReactivity() {
  /** @type {null | (() => void)} */
  let activeEffect = null;
  const subscribers = new WeakMap();
  const proxies = new WeakMap();
  function reactive(obj) {
    return proxies.getOrInsertComputed(obj, () => new Proxy(obj, {
      get(target, key, receiver) {
        if (activeEffect) {
          const byKey = subscribers.getOrInsertComputed(target, () => new Map());
          byKey.getOrInsertComputed(key, () => new Set()).add(activeEffect);
        }
        const value = Reflect.get(target, key, receiver);
        return typeof value === 'object' && value !== null ? reactive(value) : value;
      },
      set(target, key, value, receiver) {
        const ok = Reflect.set(target, key, value, receiver);
        subscribers.get(target)?.get(key)?.forEach((fn) => fn());
        return ok;
      },
    }));
  }
  function effect(fn) {
    const run = () => { const prev = activeEffect; activeEffect = run; try { fn(); } finally { activeEffect = prev; } };
    run();
  }
  return { reactive, effect };
}

/** Transpile TC39 decorators with esbuild and import the result. */
async function importDecorated(src) {
  const { code } = transformSync(src, { format: 'esm', target: 'es2022', loader: 'js' });
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}

describe('Proxy traps and Reflect (§10.5, §28)', () => {
  test('traps intercept every essential internal method used by common operations', () => {
    const log = [];
    const handler = {};
    for (const trap of ['get', 'set', 'has', 'deleteProperty', 'ownKeys', 'getOwnPropertyDescriptor', 'defineProperty']) {
      handler[trap] = (...args) => { log.push(trap); return Reflect[trap](...args); };
    }
    const p = new Proxy({ a: 1 }, handler);
    void p.a; p.b = 2; void ('a' in p); delete p.b; Object.keys(p);
    assert.deepEqual(log, ['get', 'set', 'getOwnPropertyDescriptor', 'defineProperty', 'has', 'deleteProperty',
      'ownKeys', 'getOwnPropertyDescriptor']);
  });

  test('negative indices via a get trap', () => {
    const arr = new Proxy([1, 2, 3], {
      get: (t, k, r) => (typeof k === 'string' && /^-\d+$/.test(k) ? t[t.length + Number(k)] : Reflect.get(t, k, r)),
    });
    assert.equal(arr[-1], 3);
    assert.equal(arr.length, 3);
  });

  test('NEGATIVE: a get trap cannot lie about a non-configurable, non-writable property', () => {
    const target = Object.freeze({ x: 1 });
    const liar = new Proxy(target, { get: () => 2 });
    assert.throws(() => liar.x, TypeError);
  });

  test('NEGATIVE: ownKeys must report non-configurable keys; has cannot hide them', () => {
    const target = {};
    Object.defineProperty(target, 'fixed', { value: 1, configurable: false });
    assert.throws(() => Object.keys(new Proxy(target, { ownKeys: () => [] })), TypeError);
    assert.throws(() => 'fixed' in new Proxy(target, { has: () => false }), TypeError);
  });

  test('NEGATIVE: a set trap returning false throws in strict code', () => {
    const readonly = new Proxy({}, { set: () => false });
    assert.throws(() => { /** @type {any} */ (readonly).x = 1; }, TypeError);
  });

  test('Reflect.get forwards the receiver to getters; target[key] does not', () => {
    const base = { _v: 'base', get v() { return this._v; } };
    const reads = [];
    const make = (forward) => new Proxy(base, {
      get(t, k, r) { reads.push(String(k)); return forward ? Reflect.get(t, k, r) : t[k]; },
    });
    reads.length = 0; void make(true).v;
    assert.deepEqual(reads, ['v', '_v']);       // the getter's read of _v went through the proxy
    reads.length = 0; void make(false).v;
    assert.deepEqual(reads, ['v']);             // the getter's read bypassed the proxy
  });

  test('NEGATIVE: internal slots are not forwarded (Map behind a Proxy)', () => {
    const p = new Proxy(new Map([['k', 1]]), {});
    assert.throws(() => p.get('k'), TypeError);
    const fixed = new Proxy(new Map([['k', 1]]), {
      get(t, k) { const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; },
    });
    assert.equal(fixed.get('k'), 1);
  });

  test('Array.isArray sees through proxies; typeof follows the target', () => {
    assert.equal(Array.isArray(new Proxy([], {})), true);
    assert.equal(typeof new Proxy(() => {}, {}), 'function');
    assert.equal(typeof new Proxy({}, {}), 'object');
  });

  test('NEGATIVE: a revoked proxy throws on every operation', () => {
    const { proxy, revoke } = Proxy.revocable({ a: 1 }, {});
    assert.equal(proxy.a, 1);
    revoke();
    assert.throws(() => proxy.a, TypeError);
    assert.throws(() => Object.keys(proxy), TypeError);
  });

  test('apply and construct traps', () => {
    const calls = [];
    const fn = new Proxy(function add(a, b) { return a + b; }, {
      apply(t, thisArg, args) { calls.push(args); return Reflect.apply(t, thisArg, args) * 10; },
    });
    assert.equal(fn(1, 2), 30);
    class Point { constructor(x) { this.x = x; } }
    const P = new Proxy(Point, { construct(t, args, nt) { return Reflect.construct(t, [args[0] * 2], nt); } });
    assert.equal(new P(2).x, 4);
  });

  test('reactive store: effects re-run on writes to keys they read, including nested objects', () => {
    const { reactive, effect } = createReactivity();
    const state = reactive({ user: { name: 'Ada' }, count: 0 });
    const seen = [];
    effect(() => seen.push(state.user.name));
    state.count = 1;                 // not read by the effect: no re-run
    state.user.name = 'Grace';
    assert.deepEqual(seen, ['Ada', 'Grace']);
    assert.equal(reactive(state.user) === state.user, false); // proxies of proxies are distinct...
    const raw = { a: 1 };
    assert.equal(reactive(raw), reactive(raw));                // ...but the cache returns one proxy per target
  });
});

describe('Well-known symbols (§6.1.5.1)', () => {
  test('Symbol.toPrimitive, hasInstance, toStringTag, isConcatSpreadable', () => {
    const money = { cents: 1250, [Symbol.toPrimitive](hint) { return hint === 'string' ? '€12.50' : this.cents; } };
    assert.equal(`${money}`, '€12.50');
    assert.equal(/** @type {any} */ (money) + 0, 1250);
    const Even = { [Symbol.hasInstance]: (n) => n % 2 === 0 };
    assert.equal(/** @type {any} */ (4) instanceof /** @type {any} */ (Even), true);
    class Thing { get [Symbol.toStringTag]() { return 'Thing'; } }
    assert.equal(Object.prototype.toString.call(new Thing()), '[object Thing]');
    const arrayLike = { length: 2, 0: 'a', 1: 'b', [Symbol.isConcatSpreadable]: true };
    assert.deepEqual([0].concat(/** @type {any} */ (arrayLike)), [0, 'a', 'b']);
  });

  test('Symbol.species decides the class of derived results', () => {
    class Plain extends Array { static get [Symbol.species]() { return Array; } }
    const p = Plain.from([1, 2]);
    assert.ok(p instanceof Plain);
    assert.equal(p.map((x) => x) instanceof Plain, false);
  });
});

describe('Tagged templates (§13.3.11)', () => {
  test('strings are frozen, have raw, and are cached per call site', () => {
    const seen = [];
    const tag = (strings) => { seen.push(strings); return strings; };
    for (let i = 0; i < 2; i++) tag`a${i}b`;
    tag`a${0}b`;                                   // different call site, same text
    assert.equal(seen[0], seen[1]);
    assert.notEqual(seen[0], seen[2]);
    assert.ok(Object.isFrozen(seen[0]) && Object.isFrozen(seen[0].raw));
    assert.deepEqual([...seen[0]], ['a', 'b']);
  });

  test('invalid escapes are allowed in tagged templates (cooked undefined, raw kept)', () => {
    const tag = (s) => [s[0], s.raw[0]];
    assert.deepEqual(tag`\unicode`, [undefined, '\\unicode']);
    assert.equal(String.raw`C:\new\dir`, 'C:\\new\\dir');
    assert.throws(() => new Function('return `\\unicode`'), SyntaxError);
  });

  test('a SQL tag separates code from data', () => {
    const sql = (strings, ...values) => ({ text: strings.reduce((acc, s, i) => `${acc}$${i}${s}`), values });
    const userId = "1; DROP TABLE users";
    assert.deepEqual(sql`SELECT * FROM users WHERE id = ${userId}`,
      { text: 'SELECT * FROM users WHERE id = $1', values: [userId] });
  });
});

describe('Weak collections and references (§24.3, §26)', () => {
  test('WeakMap: object keys only, not iterable, getOrInsertComputed (ES2026)', () => {
    const wm = new WeakMap();
    const key = {};
    let computed = 0;
    wm.getOrInsertComputed(key, () => ++computed);
    wm.getOrInsertComputed(key, () => ++computed);
    assert.equal(wm.get(key), 1);
    assert.throws(() => wm.set(/** @type {any} */ ('str'), 1), TypeError);
    assert.throws(() => wm.set(/** @type {any} */ (Symbol.for('registered')), 1), TypeError);
    wm.set(Symbol('unregistered'), 1);              // ES2023: non-registered symbols allowed
    assert.equal(/** @type {any} */ (wm)[Symbol.iterator], undefined);
  });

  test('WeakRef deref is stable within a job; collection happens after the job (child process)', () => {
    const src = `
      let target = { big: new Array(1e5).fill(0) };
      const ref = new WeakRef(target);
      const cleaned = [];
      const registry = new FinalizationRegistry((held) => cleaned.push(held));
      registry.register(target, 'target-held-value');
      target = null;
      globalThis.gc();
      const sameJob = ref.deref() !== undefined;   // kept alive until the end of this job
      setTimeout(() => {
        globalThis.gc();
        setTimeout(() => console.log(JSON.stringify({ sameJob, later: ref.deref() === undefined, cleaned })), 20);
      }, 0);`;
    const r = runNode(['--expose-gc', '-e', src]);
    const out = JSON.parse(r.stdout);
    assert.equal(out.sameJob, true);
    assert.equal(out.later, true);               // V8 with explicit gc(); not guaranteed by the spec
    // Cleanup callbacks are allowed to be delayed or skipped entirely; only check the type if present:
    assert.ok(out.cleaned.every((v) => v === 'target-held-value'));
  });

  test('NEGATIVE: FinalizationRegistry callbacks may never run (process exits first)', () => {
    const src = `
      const r = new FinalizationRegistry(() => console.log('cleanup ran'));
      r.register({}, 'x');
      console.log('exiting');`;
    const out = runNode(['-e', src]);
    assert.equal(out.stdout.trim(), 'exiting');
  });
});

describe('Decorators (Stage 2.7) via esbuild transpilation', () => {
  test('NEGATIVE: Node 26 cannot run decorator syntax natively', () => {
    assert.throws(() => new Function('function d(v){return v} class A { @d m() {} }'), SyntaxError);
  });

  test('context objects, replacements, initialisers and application order', async () => {
    const { log, results } = await importDecorated(`
      export const log = [];
      function rec(value, ctx) {
        log.push(ctx.kind + ':' + String(ctx.name) + (ctx.static ? ':static' : ''));
        if (ctx.kind === 'method') return function (...a) { return value.apply(this, a) + '!'; };
        if (ctx.kind === 'field') return (init) => init * 2;
        if (ctx.kind === 'accessor') return { get() { return value.get.call(this) + 100; }, set(v) { value.set.call(this, v); } };
      }
      @rec class A {
        @rec x = 21;
        @rec m() { return 'm'; }
        @rec accessor y = 1;
        @rec static s() { return 's'; }
      }
      const a = new A();
      export const results = [a.x, a.m(), a.y, A.s()];`);
    assert.deepEqual(results, [42, 'm!', 101, 's!']);
    // non-field elements (static first) before fields; class decorators last
    assert.deepEqual(log, ['method:s:static', 'method:m', 'accessor:y', 'field:x', 'class:A']);
  });

  test('addInitializer, access for private elements, and metadata', async () => {
    const mod = await importDecorated(`
      export const registry = [];
      function register(_v, ctx) { ctx.addInitializer(function () { registry.push(this.constructor.name + '#' + String(ctx.name)); }); }
      export let reader;
      function expose(_v, ctx) { reader = ctx.access; }
      function tag(name) { return (_v, ctx) => { ctx.metadata[ctx.name] = name; }; }
      export class Svc {
        @register start() {}
        @expose #secret = 7;
        @tag('column:id') id = 1;
      }
      export const meta = Svc[Symbol.metadata ?? Symbol.for('Symbol.metadata')];
      export const instance = new Svc();`);
    assert.deepEqual(mod.registry, ['Svc#start']);          // ran during construction
    assert.equal(mod.reader.get(mod.instance), 7);          // reads a #private field from outside
    assert.equal(mod.reader.has({}), false);
    assert.deepEqual(mod.meta && { ...mod.meta }, { id: 'column:id' });
  });
});
