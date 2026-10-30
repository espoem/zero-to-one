// Module 11 · Binary data, serialisation and the memory model
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import fc from 'fast-check';

/** Run `src` in n workers sharing `workerData`; resolve when all exit. */
function runWorkers(n, src, workerData) {
  return Promise.all(Array.from({ length: n }, () => new Promise((resolve, reject) => {
    const w = new Worker(src, { eval: true, workerData });
    w.on('error', reject);
    w.on('exit', resolve);
  })));
}

describe('ArrayBuffer: resizable and transferable (ES2024)', () => {
  test('length-tracking views follow resize; fixed views go out of bounds', () => {
    const rab = new ArrayBuffer(2, { maxByteLength: 8 });
    const tracking = new Uint8Array(rab);
    rab.resize(6);
    assert.equal(tracking.length, 6);
    const fixed = new Uint8Array(rab, 0, 4);
    rab.resize(2);
    assert.equal(fixed.length, 0);
    assert.throws(() => rab.resize(9), RangeError);
  });

  test('NEGATIVE: transfer() detaches the original buffer', () => {
    const ab = new ArrayBuffer(4);
    const view = new Uint8Array(ab);
    view[0] = 9;
    const moved = ab.transfer();
    assert.equal(ab.detached, true);
    assert.equal(ab.byteLength, 0);
    assert.equal(view.length, 0);
    view[0] = 1;                                   // silently ignored
    assert.equal(view[0], undefined);
    assert.throws(() => new Uint8Array(ab), TypeError);
    assert.equal(new Uint8Array(moved)[0], 9);
  });
});

describe('Typed arrays and DataView', () => {
  test('conversions on write: wrap, clamp, float16 rounding', () => {
    assert.equal(new Uint8Array([257])[0], 1);
    assert.equal(new Int8Array([200])[0], -56);
    assert.deepEqual([...new Uint8ClampedArray([300, -5, 1.5, 2.5])], [255, 0, 2, 2]); // round half to even
    assert.equal(new Float16Array([65520])[0], Infinity);
    assert.equal(new Float16Array([65504])[0], 65504);
  });

  test('NEGATIVE: misaligned typed array views throw RangeError', () => {
    assert.throws(() => new Int32Array(new ArrayBuffer(8), 2), RangeError);
  });

  test('subarray shares memory, slice copies', () => {
    const a = new Uint8Array([1, 2, 3]);
    const sub = a.subarray(1);
    const copy = a.slice(1);
    a[1] = 99;
    assert.equal(sub[0], 99);
    assert.equal(copy[0], 2);
  });

  test('DataView has explicit endianness (big-endian by default)', () => {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint16(0, 0x1234);
    dv.setUint16(2, 0x1234, true);
    assert.deepEqual([...new Uint8Array(dv.buffer)], [0x12, 0x34, 0x34, 0x12]);
  });

  test('typed arrays use platform byte order (little-endian here)', () => {
    const bytes = new Uint8Array(new Uint16Array([0x1234]).buffer);
    assert.deepEqual([...bytes], [0x34, 0x12]);
  });
});

describe('Base64 and hex (ES2026)', () => {
  test('alphabets, padding and hex', () => {
    const b = new Uint8Array([251, 255]);
    assert.equal(b.toBase64(), '+/8=');
    assert.equal(b.toBase64({ alphabet: 'base64url', omitPadding: true }), '-_8');
    assert.deepEqual([...Uint8Array.fromBase64('AQ')], [1]);
    assert.equal(new Uint8Array([1, 171]).toHex(), '01ab');
    assert.deepEqual(new Uint8Array(4).setFromBase64('AQID'), { read: 4, written: 3 });
  });

  test('NEGATIVE: strict decoding rejects malformed input', () => {
    assert.throws(() => Uint8Array.fromBase64('+/8=', { alphabet: 'base64url' }), SyntaxError);
    assert.throws(() => Uint8Array.fromBase64('AQ', { lastChunkHandling: 'strict' }), SyntaxError);
    assert.throws(() => Uint8Array.fromHex('abc'), SyntaxError);
  });

  test('property: base64 and hex round-trip, and agree with Node Buffer', () => {
    fc.assert(fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
      const b64 = bytes.toBase64();
      return b64 === Buffer.from(bytes).toString('base64') &&
        Uint8Array.fromBase64(b64).toHex() === bytes.toHex() &&
        Uint8Array.fromHex(bytes.toHex()).toBase64({ alphabet: 'base64url' }) === Buffer.from(bytes).toString('base64url').padEnd(Math.ceil(bytes.length / 3) * 4, '=');
    }));
  });
});

describe('structuredClone (HTML structured serialisation)', () => {
  test('preserves cycles, shared references, Map/Set, Date, RegExp, BigInt, -0, Error types', () => {
    const shared = { s: 1 };
    const src = { a: shared, b: shared, m: new Map([[1, new Set([2])]]), d: new Date(0), r: /x/gi, n: 10n, z: -0,
      e: new RangeError('r', { cause: 'c' }) };
    /** @type {any} */ (src).self = src;
    const c = structuredClone(src);
    assert.equal(c.self, c);
    assert.equal(c.a, c.b);
    assert.ok(c.m.get(1) instanceof Set);
    assert.ok(c.d instanceof Date);
    assert.equal(c.r.flags, 'gi');
    assert.equal(c.n, 10n);
    assert.ok(Object.is(c.z, -0));
    assert.ok(c.e instanceof RangeError);
    assert.equal(c.e.cause, 'c');
  });

  test('NEGATIVE: functions, symbols and weak collections throw DataCloneError', () => {
    for (const v of [{ f() {} }, Symbol('x'), new WeakMap()]) {
      assert.throws(() => structuredClone(v), (e) => e.name === 'DataCloneError');
    }
  });

  test('NEGATIVE: silent changes: prototype, symbol keys, getters, frozenness', () => {
    class Point { constructor() { this.x = 1; } norm() { return 1; } }
    let getterCalls = 0;
    const src = Object.freeze({ p: new Point(), [Symbol('s')]: 1, get g() { getterCalls++; return 5; } });
    const c = structuredClone(src);
    assert.equal(Object.getPrototypeOf(c.p), Object.prototype);
    assert.equal('norm' in c.p, false);
    assert.deepEqual(Object.getOwnPropertySymbols(c), []);
    assert.equal(getterCalls, 1);
    assert.equal(Object.getOwnPropertyDescriptor(c, 'g')?.value, 5);
    assert.equal(Object.isFrozen(c), false);
  });

  test('transfer moves buffers instead of copying', () => {
    const buf = new ArrayBuffer(8);
    const c = structuredClone({ buf }, { transfer: [buf] });
    assert.equal(buf.byteLength, 0);
    assert.equal(c.buf.byteLength, 8);
  });

  test('SharedArrayBuffer is shared, not copied', () => {
    const s = new SharedArrayBuffer(4);
    const c = structuredClone(s);
    assert.notEqual(c, s);
    new Int32Array(c)[0] = 7;
    assert.equal(new Int32Array(s)[0], 7);
  });
});

describe('Shared memory and Atomics (§25.4, §29)', () => {
  test('NEGATIVE: plain increments race and may lose updates; Atomics.add never does', async () => {
    const sab = new SharedArrayBuffer(8);
    const counters = new Int32Array(sab);
    const n = 100_000;
    const workers = 4;
    await runWorkers(workers, `
      const { workerData: { sab, n } } = require('node:worker_threads');
      const a = new Int32Array(sab);
      for (let i = 0; i < n; i++) { a[0]++; Atomics.add(a, 1, 1); }`, { sab, n });
    assert.equal(counters[1], n * workers);          // guaranteed
    assert.ok(counters[0] <= n * workers);           // lost updates are possible (and typical)
  });

  test('a CAS-based mutex makes plain increments safe', async () => {
    const sab = new SharedArrayBuffer(8);
    const a = new Int32Array(sab);
    const n = 20_000;
    await runWorkers(4, `
      const { workerData: { sab, n } } = require('node:worker_threads');
      const a = new Int32Array(sab);
      const lock = () => { for (let s = 0; Atomics.compareExchange(a, 0, 0, 1) !== 0; s++) {
        if (s < 100) Atomics.pause(s); else Atomics.wait(a, 0, 1); } };
      const unlock = () => { Atomics.store(a, 0, 0); Atomics.notify(a, 0, 1); };
      for (let i = 0; i < n; i++) { lock(); a[1]++; unlock(); }`, { sab, n });
    assert.equal(a[1], 4 * n);
    assert.equal(a[0], 0);
  });

  test('wait/notify between agents (deterministic handshake)', async () => {
    // slot 0: the value waited on; slot 1: worker ready flag; slot 2: what the worker observed after waking
    const sab = new SharedArrayBuffer(12);
    const a = new Int32Array(sab);
    const done = runWorkers(1, `
      const { workerData: { sab } } = require('node:worker_threads');
      const a = new Int32Array(sab);
      Atomics.store(a, 1, 1); Atomics.notify(a, 1);       // announce readiness
      const r = Atomics.wait(a, 0, 0);                     // 'ok' if notified, 'not-equal' if the store came first
      Atomics.store(a, 2, (r === 'ok' || r === 'not-equal') ? Atomics.load(a, 0) : -1);`, { sab });
    await Atomics.waitAsync(a, 1, 0).value;                // wait until the worker is (about to be) waiting
    Atomics.store(a, 0, 1);
    Atomics.notify(a, 0);
    await done;
    assert.equal(a[2], 1);                                 // either way, the worker saw the new value
  });

  test('Atomics.wait returns not-equal or timed-out without blocking forever', () => {
    const a = new Int32Array(new SharedArrayBuffer(4));
    assert.equal(Atomics.wait(a, 0, 1), 'not-equal');    // Node main thread can block ([[CanBlock]] true)
    assert.equal(Atomics.wait(a, 0, 0, 5), 'timed-out');
  });

  test('Atomics.waitAsync resolves when notified', async () => {
    const a = new Int32Array(new SharedArrayBuffer(4));
    const r = Atomics.waitAsync(a, 0, 0, 1000);
    assert.equal(r.async, true);
    setTimeout(() => { Atomics.store(a, 0, 1); Atomics.notify(a, 0); }, 5);
    assert.equal(await r.value, 'ok');
    const immediate = Atomics.waitAsync(a, 0, 0);
    assert.deepEqual(immediate, { async: false, value: 'not-equal' });
  });

  test('NEGATIVE: Atomics.wait requires an Int32Array or BigInt64Array on shared memory', () => {
    assert.throws(() => Atomics.wait(new Int32Array(4), 0, 0, 0), TypeError);          // not shared
    assert.throws(() => Atomics.wait(/** @type {any} */ (new Uint8Array(new SharedArrayBuffer(4))), 0, 0, 0), TypeError);
  });

  test('read-modify-write operations return the old value', () => {
    const a = new Int32Array(new SharedArrayBuffer(4));
    assert.equal(Atomics.add(a, 0, 5), 0);
    assert.equal(Atomics.compareExchange(a, 0, 5, 9), 5);
    assert.equal(Atomics.compareExchange(a, 0, 5, 1), 9);   // failed CAS: returns current value
    assert.equal(Atomics.load(a, 0), 9);
    assert.equal(Atomics.isLockFree(4), true);
  });
});
