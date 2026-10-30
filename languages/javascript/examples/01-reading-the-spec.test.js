// Module 01 · The specification as a tool
// Executable proofs for: Completion Records, Reference Records, early errors,
// goal symbols, evaluation order, and the engine support matrix of the pinned Node.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runNode } from './helpers/run-node.js';
import { constants } from 'node:buffer';

describe('Completion Records (§6.2.4, §14.15.3)', () => {
  test('an abrupt return in finally overrides the pending return', () => {
    function f() {
      try { return 'try'; }
      // eslint-disable-next-line no-unsafe-finally
      finally { return 'finally'; }
    }
    assert.equal(f(), 'finally');
  });

  test('NEGATIVE: break in finally silently swallows a thrown error', () => {
    function g() {
      for (;;) {
        try { throw new Error('lost'); }
        // eslint-disable-next-line no-unsafe-finally
        finally { break; }
      }
      return 'swallowed';
    }
    assert.equal(g(), 'swallowed'); // the Error never reaches the caller
  });

  test('statement completion values are observable through eval (UpdateEmpty)', () => {
    // indirect eval keeps this test independent of the module scope
    const ev = eval;
    assert.equal(ev('1; if (true) {}'), undefined); // ES2015+: `if` completes with undefined, not empty
    assert.equal(ev('do { 2 } while (false)'), 2);
    assert.equal(ev('3; var unused;'), 3);          // var declarations complete with empty
  });
});

describe('Reference Records and typeof (§6.2.5, §13.5.3)', () => {
  test('typeof an unresolvable reference is "undefined"', () => {
    // @ts-ignore deliberately undeclared
    assert.equal(typeof thisIdentifierIsNotDeclaredAnywhere, 'undefined');
  });

  test('NEGATIVE: typeof a binding in its TDZ throws ReferenceError', () => {
    assert.throws(() => new Function('typeof x; let x = 1;')(), ReferenceError);
  });

  test('NEGATIVE: reading an unresolvable reference throws ReferenceError', () => {
    assert.throws(() => new Function('return notDeclared;')(), ReferenceError);
  });
});

describe('Early errors and goal symbols (§16, Annex B.1.1)', () => {
  test('NEGATIVE: an early error prevents any statement from running', () => {
    globalThis.__ran = false;
    assert.throws(() => new Function('globalThis.__ran = true; let a; let a;'), SyntaxError);
    assert.equal(globalThis.__ran, false);
    delete globalThis.__ran;
  });

  test('`await` is an identifier in sloppy scripts but reserved in async functions', () => {
    assert.equal(new Function('var await = 7; return await;')(), 7);
    assert.throws(() => new Function('async function g() { var await = 1; }'), SyntaxError);
  });

  test('HTML-like comments are legal in the Script goal', () => {
    assert.equal(new Function('var x = 1 <!-- comment until end of line\nreturn x;')(), 1);
  });

  test('NEGATIVE: HTML-like comments are a SyntaxError in the Module goal', () => {
    const r = runNode(['--input-type=module', '-e', 'let x = 1 <!-- not a comment in modules']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /SyntaxError/);
  });

  test('NEGATIVE: `with` is a SyntaxError in strict code', () => {
    assert.throws(() => new Function('"use strict"; with ({}) {}'), SyntaxError);
    assert.doesNotThrow(() => new Function('with ({}) {}'));
  });
});

describe('Order of evaluation is specified left to right', () => {
  test('a()[b()] = c() evaluates a, b, c in order', () => {
    const log = [];
    const obj = {};
    const a = () => { log.push('a'); return obj; };
    const b = () => { log.push('b'); return 'k'; };
    const c = () => { log.push('c'); return 1; };
    a()[b()] = c();
    assert.deepEqual(log, ['a', 'b', 'c']);
    assert.equal(obj.k, 1);
  });

  test('arguments are evaluated left to right and observe earlier side effects', () => {
    let x = 0;
    const pair = (p, q) => [p, q];
    assert.deepEqual(pair(x++, x), [0, 1]);
  });

  test('[] + {} goes through ToPrimitive with the default hint', () => {
    assert.equal([] + {}, '[object Object]');
    // `{} + []` at statement start is a block followed by unary plus:
    assert.equal(eval('{} + []'), 0);
  });
});

describe('Implementation-defined limits', () => {
  test('V8 exposes its maximum String length (implementation-defined)', () => {
    assert.equal(constants.MAX_STRING_LENGTH, 2 ** 29 - 24);
  });
});

describe('Engine support matrix for the pinned runtime (Node 26.12.1 / V8 14.6)', () => {
  // If a Node upgrade changes one of these, this test fails on purpose:
  // update the table in modules/01-reading-the-spec.md together with it.
  const shipped = {
    'Map.prototype.getOrInsert (ES2026)': () => typeof Map.prototype.getOrInsert,
    'Map.prototype.getOrInsertComputed (ES2026)': () => typeof Map.prototype.getOrInsertComputed,
    'JSON.rawJSON (ES2026)': () => typeof JSON.rawJSON,
    'Iterator.concat (ES2026)': () => typeof Iterator.concat,
    'Uint8Array.fromBase64 (ES2026)': () => typeof Uint8Array.fromBase64,
    'Error.isError (ES2026)': () => typeof Error.isError,
    'Array.fromAsync (ES2026)': () => typeof Array.fromAsync,
    'DisposableStack (ES2027)': () => typeof DisposableStack,
    'Atomics.pause (ES2027)': () => typeof Atomics.pause,
  };
  for (const [name, probe] of Object.entries(shipped)) {
    test(`shipped: ${name}`, () => assert.equal(probe(), 'function'));
  }

  test('shipped: Temporal (ES2027) is on by default', () => {
    assert.equal(typeof Temporal, 'object');
  });

  test('not shipped: Math.sumPrecise (ES2026) needs --js-sum-precise', () => {
    assert.equal(typeof Math.sumPrecise, 'undefined');
    const r = runNode(['--js-sum-precise', '-p', 'Math.sumPrecise([1e20, 0.1, -1e20])']);
    assert.equal(r.stdout.trim(), '0.1');
  });

  test('not shipped: Iterator.zip and Iterator.prototype.chunks (ES2027)', () => {
    // @ts-ignore not yet in lib typings
    assert.equal(typeof Iterator.zip, 'undefined');
    // @ts-ignore
    assert.equal(typeof Iterator.prototype.chunks, 'undefined');
  });

  test('not shipped: ShadowRealm (Stage 2.7) and AsyncContext (Stage 2)', () => {
    assert.equal(typeof globalThis.ShadowRealm, 'undefined');
    assert.equal(typeof globalThis.AsyncContext, 'undefined');
  });

  test('NEGATIVE: decorator syntax (Stage 2.7) is a SyntaxError even with --js-decorators', () => {
    const r = runNode(['--js-decorators', '--input-type=module', '-e', 'function d(v){return v} class A { @d m() {} }']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /SyntaxError/);
  });
});
