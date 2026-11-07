// Module 09 · Concurrency and scaling: worker_threads, pools, shared memory, cluster, node:sqlite.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Worker, MessageChannel, receiveMessageOnPort, isMainThread } from 'node:worker_threads';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import cluster from 'node:cluster';
import { DatabaseSync } from 'node:sqlite';
import { WorkerPool } from './09-pool.ts';
import { Ring, createRing } from './09-ring.ts';
import { startNode, runNode } from './helpers/run-node.ts';

const fixture = (f: string) => new URL(`./fixtures/09-workers/${f}`, import.meta.url);

describe('worker_threads basics', () => {
  test('a worker is a separate isolate with its own globals; messages are structured clones', async () => {
    const w = new Worker(
      'const { parentPort } = require("node:worker_threads"); globalThis.mine = 1; parentPort.on("message", (m) => parentPort.postMessage({ echoed: m, isMap: m instanceof Map, seen: typeof globalThis.mine }));',
      { eval: true },
    );
    const payload = new Map([['k', { nested: new Date(0) }]]);
    w.postMessage(payload);
    const [reply] = (await once(w, 'message')) as [
      { echoed: Map<string, { nested: Date }>; isMap: boolean; seen: string },
    ];
    assert.equal(reply.isMap, true);
    assert.ok(reply.echoed.get('k')!.nested instanceof Date);
    assert.notEqual(reply.echoed, payload); // a copy, not a reference
    assert.equal((globalThis as { mine?: number }).mine, undefined);
    assert.equal(isMainThread, true);
    await w.terminate();
  });

  test('negative: functions and class identity do not survive postMessage', async () => {
    const { port1, port2 } = new MessageChannel();
    assert.throws(() => port1.postMessage({ f: () => 1 }), { name: 'DataCloneError' });
    class Point {
      x = 1;
    }
    port1.postMessage(new Point());
    const received = receiveMessageOnPort(port2)!.message;
    assert.equal(received instanceof Point, false); // a plain object arrives
    assert.equal(received.x, 1);
    port1.close();
  });

  test('transfer moves an ArrayBuffer (zero-copy) and detaches it in the sender', () => {
    const { port1, port2 } = new MessageChannel();
    const buf = new Float64Array([1, 2, 3]).buffer;
    port1.postMessage(buf, [buf]);
    assert.equal(buf.byteLength, 0); // detached
    const got = receiveMessageOnPort(port2)!.message as ArrayBuffer;
    assert.deepEqual([...new Float64Array(got)], [1, 2, 3]);
    port1.close();
  });

  test("a pooled Buffer's slab is untransferable: DataCloneError, never a silent slab transfer", async () => {
    const { isMarkedAsUntransferable } = await import('node:worker_threads');
    const small = Buffer.from('x');
    assert.equal(isMarkedAsUntransferable(small.buffer), true);
    const { port1 } = new MessageChannel();
    assert.throws(() => port1.postMessage(small.buffer, [small.buffer]), {
      name: 'DataCloneError',
    });
    port1.close();
  });

  test('an uncaught exception in a worker is an error event in the parent, then exit code 1', async () => {
    const w = new Worker('throw new Error("in worker")', { eval: true });
    const exitPromise = new Promise<number>((resolve) => w.on('exit', resolve));
    const [err] = (await once(w, 'error')) as [Error];
    assert.equal(err.message, 'in worker');
    const code = await exitPromise;
    assert.equal(code, 1);
  });

  test('resourceLimits cap a worker heap: ERR_WORKER_OUT_OF_MEMORY instead of killing the process', () => {
    // Run in a fresh process: the test runner's own process is not the place to exhaust memory.
    const r = runNode([
      '-e',
      `
      const { Worker } = require('node:worker_threads');
      const w = new Worker('const a = []; for (;;) a.push(new Array(1e5).fill(1));', { eval: true, resourceLimits: { maxOldGenerationSizeMb: 16 } });
      w.on('error', (e) => console.log('worker error', e.code));
      w.on('exit', (c) => console.log('worker exit', c, '- parent still alive'));`,
    ]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /worker error ERR_WORKER_OUT_OF_MEMORY/);
    assert.match(r.stdout, /parent still alive/);
  });
});

describe('shared memory', () => {
  test('Atomics.add from 4 workers loses no updates', async () => {
    const shared = new SharedArrayBuffer(4);
    const times = 50_000;
    const workers = Array.from(
      { length: 4 },
      () => new Worker(fixture('counter.mjs'), { workerData: { shared, times } }),
    );
    await Promise.all(workers.map((w) => once(w, 'message')));
    await Promise.all(workers.map((w) => w.terminate()));
    assert.equal(new Int32Array(shared)[0], 4 * times);
  });
});

describe('a worker pool (09-pool.ts)', () => {
  test('correct results, bounded concurrency, queueing beyond the pool size', async () => {
    const pool = new WorkerPool(fixture('task.mjs'), 2);
    const ns = [20, 21, 22, 23, 24, 25];
    const results = await Promise.all(ns.map((n) => pool.run<number>({ kind: 'fib', n })));
    assert.deepEqual(results, [6765, 10946, 17711, 28657, 46368, 75025]);
    assert.equal(pool.peakConcurrency, 2);
    await pool.close();
  });

  test('the main thread stays responsive while workers compute', async () => {
    const pool = new WorkerPool(fixture('task.mjs'), 1);
    let ticks = 0;
    let done = false;
    const pump = () => {
      if (!done) {
        ticks++;
        setImmediate(pump);
      }
    };
    pump();
    await pool.run<number>({ kind: 'fib', n: 30 });
    done = true;
    assert.ok(ticks > 10, `main loop ran ${ticks} iterations during the computation`);
    await pool.close();
  });

  test('a crashing task rejects only itself; the pool replaces the worker and continues', async () => {
    const pool = new WorkerPool(fixture('task.mjs'), 1);
    await assert.rejects(pool.run({ kind: 'crash' }), /crashed the worker/);
    assert.equal(await pool.run<number>({ kind: 'fib', n: 10 }), 55);
    await pool.close();
  });

  test('transferring input avoids a copy (the caller loses access)', async () => {
    const pool = new WorkerPool(fixture('task.mjs'), 1);
    const data = new Float64Array(1000).fill(0.5);
    const sum = await pool.run<number>({ kind: 'sum', n: data.buffer }, [data.buffer]);
    assert.equal(sum, 500);
    assert.equal(data.length, 0); // detached
    await pool.close();
  });
});

describe('cluster', () => {
  test('Linux default is round-robin scheduling in the primary', () => {
    if (process.platform !== 'win32') assert.equal(cluster.schedulingPolicy, cluster.SCHED_RR);
  });

  test('two workers share one port; round-robin spreads connections across both', async () => {
    const { child, firstLine, done } = await startNode(
      [fileURLToPath(fixture('cluster-server.cjs'))],
      'ready',
    );
    const port = Number(firstLine.split(' ')[1]);
    const pids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      pids.add(
        await new Promise<string>((resolve, reject) => {
          http
            .get({ port, host: '127.0.0.1', agent: false }, (res) => {
              let b = '';
              res.on('data', (d) => (b += d));
              res.on('end', () => resolve(b));
            })
            .on('error', reject);
        }),
      );
    }
    assert.equal(pids.size, 2);
    child.kill('SIGTERM');
    await done;
  });
});

describe('node:sqlite is synchronous', () => {
  test('in-process SQL with prepared statements; every call blocks the event loop while it runs', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE jobs (id INTEGER PRIMARY KEY, status TEXT NOT NULL)');
    const insert = db.prepare('INSERT INTO jobs (status) VALUES (?)');
    db.exec('BEGIN');
    for (let i = 0; i < 1000; i++) insert.run(i % 2 ? 'done' : 'queued');
    db.exec('COMMIT');
    const row = db.prepare('SELECT count(*) AS n FROM jobs WHERE status = ?').get('queued') as {
      n: number;
    };
    assert.equal(row.n, 500);
    db.close();
  });
});

describe('SPSC ring buffer over shared memory (09-ring.ts)', () => {
  test('single-threaded semantics: FIFO, full and empty', () => {
    const r = new Ring(createRing(3));
    assert.equal(r.pop(), undefined);
    assert.ok(r.push(1) && r.push(2) && r.push(3));
    assert.equal(r.push(4), false); // full: backpressure
    assert.equal(r.pop(), 1);
    assert.ok(r.push(4));
    assert.deepEqual([r.pop(), r.pop(), r.pop(), r.pop()], [2, 3, 4, undefined]);
  });

  test('a producer worker and the main-thread consumer: every value arrives once, in order', async () => {
    const sab = createRing(8); // much smaller than the stream: forces wrap-around and full-buffer waits
    const count = 20_000;
    const w = new Worker(fixture('ring-producer.mjs'), {
      workerData: { sab, count, ringModule: new URL('./09-ring.ts', import.meta.url).href },
    });
    const ring = new Ring(sab);
    const produced = once(w, 'message');
    let expected = 1;
    while (expected <= count) {
      const v = ring.pop();
      if (v === undefined) {
        await new Promise((r) => setImmediate(r));
        continue;
      } // main thread: never Atomics.wait
      assert.equal(v, expected);
      expected++;
    }
    await produced;
    await w.terminate();
    assert.equal(ring.pop(), undefined);
  });
});
