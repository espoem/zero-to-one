// Module 09: concurrency in applications. Event-loop blocking, worker threads, write serialisation,
// lost updates, and many writers with BEGIN IMMEDIATE.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { open, scalar, tempDir } from './helpers.ts';
import { WriteQueue } from './write-queue.ts';

const tmp = tempDir();
after(() => tmp.cleanup());
const b3 = createRequire(import.meta.url).resolve('better-sqlite3');
const SLOW =
  'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 3000000) SELECT count(*) FROM c';

function runWorker(code: string, workerData: unknown): Promise<unknown> {
  const w = new Worker(
    `const { parentPort, workerData } = require('node:worker_threads');
    const Database = require(${JSON.stringify(b3)});
    ${code}`,
    { eval: true, workerData },
  );
  return once(w, 'message').then(([m]) => m);
}

/** Measures how late a 5 ms timer fires while `work` runs. */
async function timerLag(work: () => Promise<unknown> | unknown): Promise<number> {
  const scheduled = performance.now();
  let firedAt = 0;
  const timer = new Promise<void>((r) =>
    setTimeout(() => {
      firedAt = performance.now();
      r();
    }, 5),
  );
  await work();
  await timer;
  return firedAt - scheduled - 5;
}

describe('synchronous drivers and the event loop', () => {
  test('a slow query on the main thread delays every timer by its full duration', async () => {
    const db = open();
    const t0 = performance.now();
    scalar(db, SLOW);
    const duration = performance.now() - t0;
    const lag = await timerLag(() => scalar(db, SLOW));
    assert.ok(duration > 50, `query must be measurably slow (${duration.toFixed(0)} ms)`);
    assert.ok(
      lag > duration * 0.5,
      `timer lag ${lag.toFixed(0)} ms during a ${duration.toFixed(0)} ms query`,
    );
  });

  test('the same query in a worker thread with its own connection leaves the event loop free', async () => {
    const path = tmp.file('worker.db');
    open(path).exec('CREATE TABLE t(x)');
    const t0 = performance.now();
    scalar(open(), SLOW);
    const duration = performance.now() - t0;
    const lag = await timerLag(() =>
      runWorker(
        `const db = new Database(workerData.path); parentPort.postMessage(db.prepare(workerData.sql).pluck().get());`,
        { path, sql: SLOW },
      ),
    );
    assert.ok(
      lag < duration * 0.5,
      `timer lag ${lag.toFixed(0)} ms vs query ${duration.toFixed(0)} ms`,
    );
  });
});

describe('lost updates and how SQLite prevents them', () => {
  test('negative: read-modify-write in application code across two autocommit statements loses an update', () => {
    const path = tmp.file('lost.db');
    const a = open(path);
    const b = open(path);
    a.exec('CREATE TABLE c(id INTEGER PRIMARY KEY, n INTEGER); INSERT INTO c VALUES (1, 100)');
    const read = (db: typeof a) => scalar<number>(db, 'SELECT n FROM c WHERE id = 1');
    const ra = read(a);
    const rb = read(b); // both read 100
    a.prepare('UPDATE c SET n = ? WHERE id = 1').run(ra + 1);
    b.prepare('UPDATE c SET n = ? WHERE id = 1').run(rb + 1);
    assert.equal(read(a), 101, 'two increments, one survives');
  });

  test('an atomic UPDATE ... SET n = n + 1, or BEGIN IMMEDIATE around the read, keeps both', () => {
    const path = tmp.file('atomic.db');
    const a = open(path);
    const b = open(path);
    a.exec('CREATE TABLE c(id INTEGER PRIMARY KEY, n INTEGER); INSERT INTO c VALUES (1, 100)');
    a.exec('UPDATE c SET n = n + 1 WHERE id = 1');
    b.exec('UPDATE c SET n = n + 1 WHERE id = 1');
    const inc = (db: typeof a) =>
      db
        .transaction(() => {
          const n = scalar<number>(db, 'SELECT n FROM c WHERE id = 1');
          db.prepare('UPDATE c SET n = ? WHERE id = 1').run(n + 1);
        })
        .immediate();
    inc(a);
    inc(b);
    assert.equal(scalar(a, 'SELECT n FROM c WHERE id = 1'), 104);
  });
});

describe('many writers', () => {
  test('8 worker threads x 200 BEGIN IMMEDIATE increments: no errors, no lost updates', async () => {
    const path = tmp.file('many.db');
    const setup = open(path);
    setup.pragma('journal_mode = WAL');
    setup.exec('CREATE TABLE c(id INTEGER PRIMARY KEY, n INTEGER); INSERT INTO c VALUES (1, 0)');
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        runWorker(
          `
      const db = new Database(workerData.path, { timeout: 10000 });
      const inc = db.transaction(() => {
        const n = db.prepare('SELECT n FROM c WHERE id = 1').pluck().get();
        db.prepare('UPDATE c SET n = ? WHERE id = 1').run(n + 1);
      });
      let errors = 0;
      for (let i = 0; i < 200; i++) { try { inc.immediate(); } catch (e) { errors++; } }
      parentPort.postMessage(errors);`,
          { path },
        ),
      ),
    );
    assert.deepEqual(results, Array(8).fill(0));
    assert.equal(scalar(setup, 'SELECT n FROM c WHERE id = 1'), 1600);
  });

  test('negative: the same workers with DEFERRED transactions hit SQLITE_BUSY_SNAPSHOT / BUSY', async () => {
    const path = tmp.file('deferred.db');
    const setup = open(path);
    setup.pragma('journal_mode = WAL');
    setup.exec('CREATE TABLE c(id INTEGER PRIMARY KEY, n INTEGER); INSERT INTO c VALUES (1, 0)');
    const results = (await Promise.all(
      Array.from({ length: 8 }, () =>
        runWorker(
          `
      const db = new Database(workerData.path, { timeout: 10000 });
      const inc = db.transaction(() => {
        const n = db.prepare('SELECT n FROM c WHERE id = 1').pluck().get();
        db.prepare('UPDATE c SET n = ? WHERE id = 1').run(n + 1);
      });
      const codes = {};
      for (let i = 0; i < 200; i++) { try { inc.deferred(); } catch (e) { codes[e.code] = (codes[e.code] || 0) + 1; } }
      parentPort.postMessage(codes);`,
          { path },
        ),
      ),
    )) as Record<string, number>[];
    const failures = results.reduce(
      (sum, r) => sum + Object.values(r).reduce((a, b) => a + b, 0),
      0,
    );
    const codes = new Set(results.flatMap((r) => Object.keys(r)));
    assert.ok(failures > 0, 'some deferred transactions must fail under contention');
    assert.ok(
      [...codes].every((c) => c.startsWith('SQLITE_BUSY')),
      [...codes].join(','),
    );
    assert.equal(
      scalar(setup, 'SELECT n FROM c WHERE id = 1'),
      1600 - failures,
      'every success counted exactly once',
    );
  });
});

describe('a single-writer queue', () => {
  test('group commit: queued writes from many async callers commit in few transactions', async () => {
    const db = open(tmp.file('queue.db'));
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE ev(id INTEGER PRIMARY KEY, payload TEXT)');
    const q = new WriteQueue(db);
    const ids = await Promise.all(
      Array.from({ length: 500 }, (_, i) =>
        q.enqueue((d) =>
          Number(d.prepare('INSERT INTO ev(payload) VALUES (?)').run(`e${i}`).lastInsertRowid),
        ),
      ),
    );
    assert.equal(new Set(ids).size, 500);
    assert.equal(scalar(db, 'SELECT count(*) FROM ev'), 500);
    assert.ok(q.transactions < 10, `500 writes in ${q.transactions} transactions`);
  });

  test('negative: one failing job is rolled back alone and rejects only its own promise', async () => {
    const db = open(tmp.file('queue2.db'));
    db.exec('CREATE TABLE u(k TEXT PRIMARY KEY)');
    const q = new WriteQueue(db);
    const results = await Promise.allSettled([
      q.enqueue((d) => d.prepare("INSERT INTO u VALUES ('a')").run().changes),
      q.enqueue((d) => d.prepare("INSERT INTO u VALUES ('a')").run().changes), // duplicate
      q.enqueue((d) => d.prepare("INSERT INTO u VALUES ('b')").run().changes),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      ['fulfilled', 'rejected', 'fulfilled'],
    );
    assert.deepEqual(db.prepare('SELECT k FROM u ORDER BY k').pluck().all(), ['a', 'b']);
  });

  test('batched commits are much faster than one transaction per insert', () => {
    const db = open(tmp.file('speed.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.exec('CREATE TABLE t(x)');
    const ins = db.prepare('INSERT INTO t VALUES (?)');
    let t0 = performance.now();
    for (let i = 0; i < 1000; i++) ins.run(i);
    const single = performance.now() - t0;
    t0 = performance.now();
    db.transaction(() => {
      for (let i = 0; i < 1000; i++) ins.run(i);
    })();
    const batched = performance.now() - t0;
    assert.ok(
      batched < single,
      `batched ${batched.toFixed(1)} ms vs single ${single.toFixed(1)} ms`,
    );
  });
});
