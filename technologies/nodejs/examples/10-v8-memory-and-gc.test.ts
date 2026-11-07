// Module 10 · V8 memory and garbage collection in Node: heap spaces, limits, OOM, external memory, leaks.
// Every flag experiment runs in a child process; GC-dependent assertions use --expose-gc and explicit gc().
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import v8 from 'node:v8';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNode } from './helpers/run-node.ts';

const limitMB = (flags: string[]) =>
  Number(
    runNode([
      ...flags,
      '-p',
      'Math.round(require("v8").getHeapStatistics().heap_size_limit / 2 ** 20)',
    ]).stdout.trim(),
  );

describe('heap layout', () => {
  test('V8 14.6 heap spaces as Node reports them', () => {
    const names = v8.getHeapSpaceStatistics().map((s) => s.space_name);
    for (const n of [
      'new_space',
      'old_space',
      'code_space',
      'large_object_space',
      'new_large_object_space',
      'trusted_space',
    ]) {
      assert.ok(names.includes(n), n);
    }
  });

  test('Buffers live outside the V8 heap: arrayBuffers grows, heapUsed does not', () => {
    const before = process.memoryUsage();
    const big = Buffer.alloc(64 * 1024 * 1024, 1);
    const after = process.memoryUsage();
    assert.ok(after.arrayBuffers - before.arrayBuffers >= 64 * 1024 * 1024);
    assert.ok(after.heapUsed - before.heapUsed < 8 * 1024 * 1024);
    assert.equal(big[0], 1);
  });
});

describe('heap limits are flags', () => {
  test('--max-old-space-size raises or lowers the limit (heap_size_limit also counts the young generation)', () => {
    const small = limitMB(['--max-old-space-size=100']);
    const large = limitMB(['--max-old-space-size=400']);
    assert.ok(small >= 100 && small < 400, String(small));
    assert.equal(large - small, 300);
  });

  test('--max-old-space-size-percentage sizes the heap from available (or cgroup-constrained) memory', () => {
    const p10 = limitMB(['--max-old-space-size-percentage=10']);
    const p20 = limitMB(['--max-old-space-size-percentage=20']);
    assert.ok(p20 > p10);
  });

  test('NODE_OPTIONS carries V8 heap flags into every child Node process', () => {
    const r = runNode(
      ['-p', 'Math.round(require("v8").getHeapStatistics().heap_size_limit / 2 ** 20)'],
      { env: { NODE_OPTIONS: '--max-old-space-size=150' } },
    );
    assert.equal(Number(r.stdout.trim()), limitMB(['--max-old-space-size=150']));
  });
});

describe('out of memory', () => {
  test('a V8 heap OOM is a fatal error and SIGABRT (134 in a shell), not a catchable exception', () => {
    const r = runNode([
      '--max-old-space-size=32',
      '-e',
      'try { const a = []; for (;;) a.push(new Array(1e5).fill(1)); } catch (e) { console.log("caught?!"); }',
    ]);
    assert.equal(r.status, null);
    assert.equal(r.signal, 'SIGABRT');
    assert.match(r.stderr, /JavaScript heap out of memory/);
    assert.doesNotMatch(r.stdout, /caught/);
  });

  test('--heapsnapshot-near-heap-limit writes evidence before dying', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-oom-'));
    try {
      const r = runNode(
        [
          '--max-old-space-size=48',
          '--heapsnapshot-near-heap-limit=1',
          '-e',
          'const a = []; for (;;) a.push(new Array(1e5).fill({}));',
        ],
        { cwd: dir, timeout: 120_000 },
      );
      assert.equal(r.signal, 'SIGABRT');
      assert.ok(readdirSync(dir).some((f) => f.endsWith('.heapsnapshot')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('collection and leaks (child processes with --expose-gc)', () => {
  const gcRun = (body: string) =>
    runNode([
      '--expose-gc',
      '--input-type=module',
      '-e',
      `
    const settle = async () => { for (let i = 0; i < 3; i++) { globalThis.gc(); await new Promise((r) => setTimeout(r, 0)); } };
    ${body}`,
    ]);

  test('an unreachable object is collected (WeakRef observes it)', () => {
    const r = gcRun(
      `let o = { big: new Array(1e5).fill(0) }; const ref = new WeakRef(o); o = null; await settle(); console.log(ref.deref() === undefined);`,
    );
    assert.equal(r.stdout.trim(), 'true');
  });

  test('negative: a listener on a long-lived emitter keeps its closure (and everything it captures) alive', () => {
    const r = gcRun(`
      import { EventEmitter } from 'node:events';
      const bus = new EventEmitter();
      function handle() { const req = { body: new Array(1e5).fill(0) }; bus.on('tick', () => req.body.length); return new WeakRef(req); }
      const ref = handle();
      await settle();
      console.log(ref.deref() !== undefined, bus.listenerCount('tick'));`);
    assert.equal(r.stdout.trim(), 'true 1');
  });

  test('a Map entry keeps its key alive; a WeakMap entry does not', () => {
    const r = gcRun(`
      const map = new Map(); const weak = new WeakMap();
      let k1 = {}; let k2 = {};
      const r1 = new WeakRef(k1), r2 = new WeakRef(k2);
      map.set(k1, 'meta'); weak.set(k2, 'meta');
      k1 = null; k2 = null;
      await settle();
      console.log(r1.deref() !== undefined, r2.deref() === undefined);`);
    assert.equal(r.stdout.trim(), 'true true');
  });

  test('negative: a short slice of a huge string can keep the whole parent alive (V8 sliced strings)', () => {
    const r = runNode([
      '--expose-gc',
      '-e',
      `
      const keep = []; gc(); const h0 = process.memoryUsage().heapUsed;
      for (let i = 0; i < 5; i++) { const big = ('x' + i).repeat(4e6) + String(Math.random()); keep.push(big.slice(0, 20)); }
      gc(); const sliced = process.memoryUsage().heapUsed - h0;
      const copies = keep.map((s) => Buffer.from(s).toString()); keep.length = 0;
      gc(); const copied = process.memoryUsage().heapUsed - h0;
      console.log(JSON.stringify({ sliced: sliced / 2 ** 20, copied: copied / 2 ** 20, n: copies.length }));`,
    ]);
    const { sliced, copied } = JSON.parse(r.stdout) as { sliced: number; copied: number };
    assert.ok(sliced > 30, `20-char slices retained ${sliced.toFixed(1)} MiB`);
    assert.ok(sliced - copied > 20, `copying released ${(sliced - copied).toFixed(1)} MiB`);
  });

  test('--trace-gc shows young-generation scavenges and a full mark-compact', () => {
    const r = runNode([
      '--trace-gc',
      '--expose-gc',
      '-e',
      'let a = []; for (let i = 0; i < 3e5; i++) a.push({ i }); a = null; gc();',
    ]);
    assert.match(r.stdout, /Scavenge/);
    assert.match(r.stdout, /Mark-Compact/);
  });
});

describe('heap statistics API', () => {
  test('getHeapStatistics exposes used, total and limit; external memory is reported separately', () => {
    const h = v8.getHeapStatistics();
    assert.ok(h.used_heap_size <= h.total_heap_size);
    assert.ok(h.total_heap_size <= h.heap_size_limit);
    assert.equal(typeof h.external_memory, 'number');
  });

  test('v8.setFlagsFromString exists but must not be used to change heap limits after start', () => {
    assert.equal(typeof v8.setFlagsFromString, 'function');
  });
});
