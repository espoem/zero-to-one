// Module 03 · Execution contexts, scope, closures and `this`
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { runNode } from './helpers/run-node.js';

/** Run source as a classic, sloppy *script* in a fresh context (modules are always strict). */
// JSON round-trip: values from another realm have another Array.prototype (see module 06).
const script = (src) => JSON.parse(JSON.stringify(vm.runInNewContext(src, {})));

describe('Declaration instantiation ("hoisting", §10.2.11, §16.1.7)', () => {
  test('var is initialized to undefined, function declarations to the function', () => {
    assert.deepEqual(script(`
      const r = [typeof v, typeof f];
      var v = 1;
      function f() {}
      r;`), ['undefined', 'function']);
  });

  test('NEGATIVE: let/const/class are in the TDZ until evaluated', () => {
    assert.throws(() => script('x; let x = 1;'), (e) => e.name === 'ReferenceError');
    assert.throws(() => script('new C(); class C {}'), (e) => e.name === 'ReferenceError');
    assert.throws(() => script('let y = y;'), (e) => e.name === 'ReferenceError');
  });

  test('the TDZ is temporal: a function defined earlier may read the binding later', () => {
    assert.equal(script('function readLater() { return value; } let value = 42; readLater();'), 42);
    assert.throws(() => script('{ readLater2(); let v2 = 1; function readLater2() { return v2; } }'),
      (e) => e.name === 'ReferenceError');
  });

  test('NEGATIVE: default parameters cannot read later parameters (TDZ)', () => {
    const f = new Function('return function (a = b, b = 1) { return a; }')();
    assert.throws(() => f(), ReferenceError);
    assert.equal(f(5), 5);
  });

  test('global var creates a global object property, global let does not', () => {
    const ctx = {};
    vm.runInNewContext('var a = 1; let b = 2; function c() {}', ctx);
    assert.equal(ctx.a, 1);
    assert.equal(ctx.b, undefined);
    assert.equal(typeof ctx.c, 'function');
    // vm sandboxes use interceptors, so check descriptors in a real global (child process):
    const r = runNode(['-e', `require('node:vm').runInThisContext('var a = 1; let b = 2;');
      console.log(Object.getOwnPropertyDescriptor(globalThis, 'a').configurable, 'b' in globalThis)`]);
    assert.equal(r.stdout.trim(), 'false false');
  });

  test('NEGATIVE: let colliding with an existing global var is a SyntaxError before anything runs', () => {
    // Two classic scripts sharing one global environment (GlobalDeclarationInstantiation checks).
    const r = runNode(['-e', `
      const vm = require('node:vm');
      vm.runInThisContext('var dup = 1;');
      try { vm.runInThisContext('globalThis.ran = true; let dup = 2;'); }
      catch (e) { console.log(e.name, typeof globalThis.ran); }`]);
    assert.equal(r.stdout.trim(), 'SyntaxError undefined');
  });

  test('module code has its own scope: top-level var is not a global property', () => {
    const r = runNode(['--input-type=module', '-e', 'var leaked = 1; console.log(typeof globalThis.leaked)']);
    assert.equal(r.stdout.trim(), 'undefined');
  });

  test('Annex B.3.3: sloppy block function is also var-bound in the enclosing scope', () => {
    assert.deepEqual(script(`
      const r = [typeof f];
      { function f() {} }
      r.push(typeof f);
      r;`), ['undefined', 'function']);
    assert.deepEqual(script(`'use strict';
      { function g() {} }
      [typeof g];`), ['undefined']);
  });
});

describe('Closures', () => {
  test('two closures share one Environment Record', () => {
    function counter() {
      let n = 0;
      return { inc: () => ++n, get: () => n };
    }
    const c = counter();
    c.inc(); c.inc();
    assert.equal(c.get(), 2);
  });

  test('NEGATIVE: var in a loop has one binding; let has one per iteration', () => {
    const fs = [];
    for (var i = 0; i < 3; i++) fs.push(() => i);
    assert.deepEqual(fs.map((f) => f()), [3, 3, 3]);
    const gs = [];
    for (let j = 0; j < 3; j++) gs.push(() => j);
    assert.deepEqual(gs.map((g) => g()), [0, 1, 2]);
  });

  test('per-iteration copy happens before the increment expression', () => {
    const fs = [];
    for (let i = 0; i < 2; fs.push(() => i), i++);
    // the closure pushed in the increment expression sees the *new* iteration's binding
    assert.deepEqual(fs.map((f) => f()), [1, 2]);
  });

  test('stale closure: a closure reads the binding it captured, not a later one', () => {
    const renders = [];
    function render(count) { renders.push(() => count); }
    render(1); render(2);
    assert.equal(renders[0](), 1); // the first "render's" callback is stuck at 1
  });

  test('NEGATIVE: V8 shares one Context per scope, so a sibling closure retains a large object', () => {
    const src = `
      function withSibling() {
        const big = { payload: new Array(1e5).fill(1) };
        const ref = new WeakRef(big);
        const unused = () => big;   // forces big into the shared Context
        const keep = () => 1;       // never mentions big
        return { keep, ref };
      }
      function withoutSibling() {
        const big = { payload: new Array(1e5).fill(1) };
        const ref = new WeakRef(big);
        const keep = () => 1;
        return { keep, ref };
      }
      const a = withSibling(), b = withoutSibling();
      await new Promise((r) => setTimeout(r, 0)); // end the job so WeakRef targets are not kept alive
      globalThis.gc();
      console.log(JSON.stringify([a.ref.deref() !== undefined, b.ref.deref() !== undefined]));`;
    const r = runNode(['--expose-gc', '--input-type=module', '-e', src]);
    assert.deepEqual(JSON.parse(r.stdout), [true, false]); // V8-specific; pinned to Node 26
  });
});

describe('this (§10.2.1.2 OrdinaryCallBindThis)', () => {
  const obj = { name: 'obj', who() { return this?.name; } };

  test('call forms decide thisArgument', () => {
    assert.equal(obj.who(), 'obj');
    assert.equal((obj.who)(), 'obj');           // parentheses keep the Reference
    assert.equal(obj?.who(), 'obj');
    assert.equal((0, obj.who)(), undefined);    // comma operator drops the Reference
    const extracted = obj.who;
    assert.equal(extracted(), undefined);       // module code is strict
    assert.equal(obj.who.call({ name: 'x' }), 'x');
  });

  test('sloppy functions get globalThis and boxed primitives; strict ones do not', () => {
    const sloppy = new Function('return this');
    const strict = new Function('"use strict"; return this');
    assert.equal(sloppy(), globalThis);
    assert.equal(typeof sloppy.call(5), 'object');
    assert.equal(strict(), undefined);
    assert.equal(strict.call(5), 5);
  });

  test('arrow functions ignore call, apply, bind and new', () => {
    const outer = { v: 1, make() { return () => this.v; } };
    const arrow = outer.make();
    assert.equal(arrow.call({ v: 2 }), 1);
    assert.equal(arrow.bind({ v: 3 })(), 1);
    assert.throws(() => new (/** @type {any} */ (arrow))(), TypeError);
    assert.equal('prototype' in arrow, false);
  });

  test('bound functions: rebinding, new, name, length, prototype (§10.4.1)', () => {
    function f(a, b, c) { return [this?.id, a, b, c]; }
    const b1 = f.bind({ id: 1 }, 'a');
    const b2 = b1.bind({ id: 2 }, 'b');
    assert.deepEqual(b2('c'), [1, 'a', 'b', 'c']);     // the first bind wins; args accumulate
    assert.equal(b1.name, 'bound f');
    assert.equal(b1.length, 2);
    assert.equal(b2.name, 'bound bound f');
    assert.equal('prototype' in b1, false);

    function P(x) { this.x = x; }
    const BoundP = P.bind({ ignored: true }, 7);
    const p = new BoundP();
    assert.equal(p.x, 7);                               // new ignores [[BoundThis]]
    assert.ok(p instanceof P);
    assert.ok(p instanceof BoundP);                     // instanceof delegates to the target
  });

  test('NEGATIVE: an extracted class method has this === undefined', () => {
    class Counter { n = 0; inc() { return ++this.n; } }
    const { inc } = new Counter();
    assert.throws(() => inc(), TypeError);
  });

  test('class field arrows capture the instance; prototype methods do not', () => {
    class Button {
      label = 'ok';
      onClick = () => this.label;
      method() { return this?.label; }
    }
    const btn = new Button();
    const { onClick, method } = btn;
    assert.equal(onClick(), 'ok');
    assert.equal(method(), undefined);
    assert.equal(Object.hasOwn(btn, 'onClick'), true);
    assert.equal(Object.hasOwn(Button.prototype, 'onClick'), false);
    assert.notEqual(new Button().onClick, btn.onClick);  // one function per instance
  });

  test('NEGATIVE: derived constructors cannot use this before super()', () => {
    class A {}
    class B extends A { constructor() { /** @type {any} */ (this).x = 1; super(); } }
    assert.throws(() => new B(), ReferenceError);
  });

  test('super.method() keeps the current this', () => {
    class A { who() { return this.tag; } }
    class B extends A { tag = 'b'; who() { return 'B:' + super.who(); } }
    assert.equal(new B().who(), 'B:b');
  });
});

describe('Strict mode (§11.2.2)', () => {
  test('NEGATIVE: assigning an undeclared identifier throws in strict code, leaks in sloppy code', () => {
    const ctx = {};
    vm.runInNewContext('leak = 1', ctx);
    assert.equal(ctx.leak, 1);
    assert.throws(() => vm.runInNewContext('"use strict"; leak2 = 1', {}), (e) => e.name === 'ReferenceError');
  });

  test('arguments is mapped in sloppy mode, unmapped in strict mode', () => {
    const sloppy = new Function('a', 'arguments[0] = 9; return a;');
    const strict = new Function('a', '"use strict"; arguments[0] = 9; return a;');
    assert.equal(sloppy(1), 9);
    assert.equal(strict(1), 1);
  });

  test('NEGATIVE: silent failures become TypeErrors in strict code', () => {
    const frozen = Object.freeze({ x: 1 });
    assert.throws(() => { /** @type {any} */ (frozen).x = 2; }, TypeError);
    const sloppySet = new Function('o', 'o.x = 2; return o.x;');
    assert.equal(sloppySet(frozen), 1); // silently ignored
  });
});

describe('eval and new Function (§19.2.1.1 PerformEval)', () => {
  test('direct eval sees locals; indirect eval and new Function see only globals', () => {
    const viaDirect = new Function(`
      var local = 'local';
      return [eval('typeof local'), (0, eval)('typeof local'), new Function('return typeof local')()];`);
    assert.deepEqual(viaDirect(), ['string', 'undefined', 'undefined']);
  });

  test('sloppy direct eval can add var bindings to the caller; strict eval cannot', () => {
    const sloppy = new Function('eval("var added = 1"); return typeof added;');
    const strict = new Function('"use strict"; eval("var added = 1"); return typeof added;');
    assert.equal(sloppy(), 'number');
    assert.equal(strict(), 'undefined');
  });

  test('NEGATIVE: --disallow-code-generation-from-strings blocks eval', () => {
    const r = runNode(['--disallow-code-generation-from-strings', '-e', 'eval("1")']);
    assert.match(r.stderr, /EvalError/);
  });
});
