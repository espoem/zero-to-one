// Module 06: WAL mode. Snapshots, concurrency, checkpoints, starvation, the WAL file format.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { open, scalar, errorCode, tempDir, type Db } from './helpers.ts';

const tmp = tempDir();
after(() => tmp.cleanup());
let n = 0;
const betterSqlite3Path = createRequire(import.meta.url).resolve('better-sqlite3');

function wal(count = 2): { path: string; c: Db[] } {
  const path = tmp.file(`wal${n++}.db`);
  const first = open(path);
  assert.equal(first.pragma('journal_mode = WAL', { simple: true }), 'wal');
  first.exec(
    'CREATE TABLE t(id INTEGER PRIMARY KEY, v INTEGER); INSERT INTO t VALUES (1, 100), (2, 200);',
  );
  const c = [first];
  for (let i = 1; i < count; i++) c.push(open(path, { timeout: 0 }));
  first.pragma('busy_timeout = 0');
  return { path, c };
}
const walPages = (path: string, pageSize = 4096) =>
  (statSync(`${path}-wal`).size - 32) / (pageSize + 24);

describe('readers and the writer do not block each other', () => {
  test('-wal and -shm appear; journal_mode=WAL is persistent across connections', () => {
    const { path } = wal(1);
    assert.ok(existsSync(`${path}-wal`) && existsSync(`${path}-shm`));
    const again = open(path);
    assert.equal(again.pragma('journal_mode', { simple: true }), 'wal');
  });

  test('a reader in a transaction keeps its snapshot while a writer commits', () => {
    const {
      c: [w, r],
    } = wal();
    r!.exec('BEGIN');
    assert.equal(scalar(r!, 'SELECT v FROM t WHERE id = 1'), 100); // snapshot taken here
    w!.exec('UPDATE t SET v = 101 WHERE id = 1'); // commits without waiting for the reader
    assert.equal(
      scalar(r!, 'SELECT v FROM t WHERE id = 1'),
      100,
      'repeatable read inside the snapshot',
    );
    r!.exec('COMMIT');
    assert.equal(
      scalar(r!, 'SELECT v FROM t WHERE id = 1'),
      101,
      'next transaction sees the new commit',
    );
  });

  test('a writer holding an open write transaction does not block new readers', () => {
    const {
      c: [w, r],
    } = wal();
    w!.exec('BEGIN IMMEDIATE; UPDATE t SET v = 0');
    assert.equal(scalar(r!, 'SELECT sum(v) FROM t'), 300, 'readers see the last committed state');
    w!.exec('COMMIT');
  });

  test('writers are still serialised: one write transaction at a time', () => {
    const {
      c: [a, b],
    } = wal();
    a!.exec('BEGIN IMMEDIATE');
    assert.equal(
      errorCode(() => b!.exec('BEGIN IMMEDIATE')),
      'SQLITE_BUSY',
    );
    a!.exec('COMMIT');
  });

  test('a separate process reads committed data while this process holds a write transaction', () => {
    const {
      path,
      c: [w],
    } = wal(1);
    w!.exec('BEGIN IMMEDIATE; UPDATE t SET v = 0');
    const out = execFileSync(process.execPath, [
      '-e',
      `const D=require(${JSON.stringify(betterSqlite3Path)});const d=new D(process.argv[1],{timeout:0});` +
        `process.stdout.write(String(d.prepare('SELECT sum(v) FROM t').pluck().get()))`,
      path,
    ]).toString();
    assert.equal(out, '300');
    w!.exec('COMMIT');
  });
});

describe('SQLITE_BUSY_SNAPSHOT: upgrading a stale read transaction', () => {
  test('a read transaction that becomes stale can never write; busy_timeout does not help', () => {
    const {
      c: [a, b],
    } = wal();
    b!.pragma('busy_timeout = 3000');
    b!.exec('BEGIN');
    scalar(b!, 'SELECT v FROM t WHERE id = 1'); // snapshot S1
    a!.exec('UPDATE t SET v = 0 WHERE id = 2'); // commit S2 > S1
    const t0 = performance.now();
    assert.equal(
      errorCode(() => b!.exec('UPDATE t SET v = 1 WHERE id = 1')),
      'SQLITE_BUSY_SNAPSHOT',
    );
    assert.ok(performance.now() - t0 < 1000, 'returned at once');
    // Retrying inside the same transaction fails forever: the snapshot cannot move forward.
    assert.equal(
      errorCode(() => b!.exec('UPDATE t SET v = 1 WHERE id = 1')),
      'SQLITE_BUSY_SNAPSHOT',
    );
    b!.exec('ROLLBACK');
    b!.exec('BEGIN IMMEDIATE; UPDATE t SET v = 1 WHERE id = 1; COMMIT');
  });

  test('BEGIN IMMEDIATE takes the write lock before reading, so its snapshot is always current', () => {
    const {
      c: [a, b],
    } = wal();
    b!.exec('BEGIN IMMEDIATE');
    const v = scalar<number>(b!, 'SELECT v FROM t WHERE id = 1');
    assert.equal(
      errorCode(() => a!.exec('UPDATE t SET v = 0')),
      'SQLITE_BUSY',
    );
    b!.prepare('UPDATE t SET v = ? WHERE id = 1').run(v + 1);
    b!.exec('COMMIT');
    assert.equal(scalar(a!, 'SELECT v FROM t WHERE id = 1'), 101);
  });
});

describe('checkpoints', () => {
  test('PASSIVE copies what it can; an old reader pins frames it may not overwrite', () => {
    const {
      c: [w, r],
    } = wal();
    w!.pragma('wal_autocheckpoint = 0'); // manual control
    w!.exec('UPDATE t SET v = v + 1'); // frames in the WAL
    r!.exec('BEGIN');
    scalar(r!, 'SELECT count(*) FROM t'); // r's snapshot ends at the current WAL end
    w!.exec('UPDATE t SET v = v + 1'); // more frames, newer than r's snapshot
    const [res] = w!.pragma('wal_checkpoint(PASSIVE)') as {
      busy: number;
      log: number;
      checkpointed: number;
    }[];
    assert.ok(
      res!.checkpointed < res!.log,
      `only frames up to the reader's mark: ${JSON.stringify(res)}`,
    );
    r!.exec('COMMIT');
    const [res2] = w!.pragma('wal_checkpoint(PASSIVE)') as { log: number; checkpointed: number }[];
    assert.equal(res2!.checkpointed, res2!.log, 'everything once the reader is gone');
  });

  test('TRUNCATE reports busy while a reader is active, and empties the WAL file once it can', () => {
    const {
      path,
      c: [w, r],
    } = wal();
    w!.pragma('wal_autocheckpoint = 0');
    w!.exec('UPDATE t SET v = v + 1');
    r!.exec('BEGIN');
    scalar(r!, 'SELECT 1 FROM t');
    w!.exec('UPDATE t SET v = v + 1');
    const [busy] = w!.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[];
    assert.equal(busy!.busy, 1);
    r!.exec('COMMIT');
    const [ok] = w!.pragma('wal_checkpoint(TRUNCATE)') as { busy: number; log: number }[];
    assert.deepEqual([ok!.busy, ok!.log], [0, 0]);
    assert.equal(statSync(`${path}-wal`).size, 0);
  });

  test('checkpoint starvation: a reader that never lets go makes the WAL grow without bound', () => {
    const {
      path,
      c: [w, r],
    } = wal();
    assert.equal(scalar(w!, 'PRAGMA wal_autocheckpoint'), 1000, 'default: 1000 pages');
    w!.pragma('wal_autocheckpoint = 10');
    const ins = w!.prepare('INSERT INTO t(v) VALUES (?)');
    // Without a long reader the WAL is reset and reused, so its size stays bounded.
    for (let i = 0; i < 600; i++) ins.run(i);
    const bounded = walPages(path);
    // With a long reader, auto-checkpoints cannot reset the WAL.
    r!.exec('BEGIN');
    scalar(r!, 'SELECT count(*) FROM t');
    for (let i = 0; i < 600; i++) ins.run(i);
    const starved = walPages(path);
    assert.ok(starved > bounded * 5, `WAL grew from ${bounded} to ${starved} frames`);
    r!.exec('COMMIT');
    w!.pragma('wal_checkpoint(TRUNCATE)');
    assert.equal(statSync(`${path}-wal`).size, 0);
  });

  test('journal_size_limit truncates the WAL after a checkpoint resets it', () => {
    const {
      path,
      c: [w],
    } = wal(1);
    w!.pragma('wal_autocheckpoint = 0');
    const ins = w!.prepare('INSERT INTO t(v) VALUES (?)');
    w!.transaction(() => {
      for (let i = 0; i < 5000; i++) ins.run(i);
    })();
    w!.pragma('wal_checkpoint(PASSIVE)');
    const big = statSync(`${path}-wal`).size;
    w!.pragma('journal_size_limit = 65536');
    ins.run(1); // the next write restarts the WAL from the beginning and truncates it
    assert.ok(
      statSync(`${path}-wal`).size <= 65536 && big > 65536,
      `${big} -> ${statSync(`${path}-wal`).size}`,
    );
  });

  test('closing the last connection checkpoints and removes -wal and -shm', () => {
    const { path, c } = wal(2);
    c.forEach((db) => db.close());
    assert.ok(!existsSync(`${path}-wal`) && !existsSync(`${path}-shm`));
  });
});

describe('durability settings and the WAL file format', () => {
  test('better-sqlite3 defaults to synchronous=NORMAL in WAL mode', () => {
    const {
      c: [w],
    } = wal(1);
    assert.equal(scalar(w!, 'PRAGMA synchronous'), 1);
    w!.pragma('synchronous = FULL');
    assert.equal(scalar(w!, 'PRAGMA synchronous'), 2);
  });

  test('WAL header and frame headers: magic, page size, commit frames carry the db size', () => {
    const {
      path,
      c: [w],
    } = wal(1);
    w!.pragma('wal_autocheckpoint = 0');
    w!.exec('UPDATE t SET v = 7 WHERE id = 1'); // one more commit
    const buf = readFileSync(`${path}-wal`);
    const dv = new DataView(buf.buffer, buf.byteOffset);
    const magic = dv.getUint32(0);
    assert.ok(
      magic === 0x377f0682 || magic === 0x377f0683,
      'checksum byte order flag in the low bit',
    );
    assert.equal(dv.getUint32(4), 3007000, 'WAL format version');
    assert.equal(dv.getUint32(8), 4096, 'page size');
    const frames = (buf.length - 32) / (4096 + 24);
    assert.ok(Number.isInteger(frames) && frames >= 2);
    const commits: number[] = [];
    for (let i = 0; i < frames; i++) {
      const off = 32 + i * (4096 + 24);
      const dbSizeAfterCommit = dv.getUint32(off + 4); // non-zero only on the last frame of a transaction
      if (dbSizeAfterCommit > 0) commits.push(i);
    }
    assert.equal(commits.at(-1), frames - 1, 'the last frame is a commit frame');
    assert.ok(commits.length >= 2, 'one commit frame per transaction');
  });

  test('locking_mode=EXCLUSIVE before entering WAL: no shared-memory file at all', () => {
    const path = tmp.file('excl.db');
    const db = open(path);
    db.pragma('locking_mode = EXCLUSIVE');
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE t(x); INSERT INTO t VALUES (1)');
    assert.ok(existsSync(`${path}-wal`));
    assert.ok(!existsSync(`${path}-shm`), 'wal-index kept in heap memory');
    // Any other connection is locked out, even for reading (open() itself runs a SELECT).
    assert.equal(
      errorCode(() => open(path, { timeout: 0 }).prepare('SELECT * FROM t').all()),
      'SQLITE_BUSY',
    );
  });

  test('negative: reading the main file alone while a WAL holds committed data gives stale content', () => {
    const {
      path,
      c: [w],
    } = wal(1);
    w!.pragma('wal_autocheckpoint = 0');
    w!.exec("CREATE TABLE secret(x); INSERT INTO secret VALUES ('only in the WAL')");
    // A naive "backup" that copies only the .db file misses everything since the last checkpoint.
    const copy = tmp.file(`copy${n}.db`);
    writeFileSync(copy, readFileSync(path)); // only the main file, deliberately leaving -wal behind
    const c = open(copy);
    assert.equal(scalar(c, "SELECT count(*) FROM sqlite_schema WHERE name = 'secret'"), 0);
  });
});

describe('a checkpoint policy for applications (§ 6.4)', async () => {
  const { walHealth, tick } = await import('./checkpointer.ts');

  test('walHealth flags starvation; tick truncates once the reader is gone', () => {
    const {
      c: [w, r],
    } = wal();
    w!.pragma('wal_autocheckpoint = 0');
    const ins = w!.prepare('INSERT INTO t(v) VALUES (?)');
    r!.exec('BEGIN');
    scalar(r!, 'SELECT 1 FROM t');
    w!.transaction(() => {
      for (let i = 0; i < 2000; i++) ins.run('x'.repeat(1000));
    })();
    const h = walHealth(w!);
    assert.equal(h.starved, true);
    assert.ok(h.pending > 0 && h.walBytes > 65536);
    assert.equal(
      tick(w!, 65536),
      'starved',
      'TRUNCATE cannot complete while the reader holds its snapshot',
    );
    r!.exec('COMMIT');
    assert.equal(tick(w!, 65536), 'truncated');
    assert.deepEqual(walHealth(w!), { pending: 0, walBytes: 0, starved: false });
  });
});
