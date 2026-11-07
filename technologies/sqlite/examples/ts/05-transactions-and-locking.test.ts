// Module 05: rollback-journal mode, lock states, BEGIN modes, SQLITE_BUSY, hot journals, savepoints.
// All tests use real files and several connections (and one child process) on the same file.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { open, scalar, errorCode, tempDir, type Db } from './helpers.ts';

const tmp = tempDir();
after(() => tmp.cleanup());
let n = 0;
const betterSqlite3Path = createRequire(import.meta.url).resolve('better-sqlite3');

/** Two (or more) connections to a fresh rollback-journal database with no busy timeout. */
function fresh(count = 2, mode = 'DELETE'): { path: string; c: Db[] } {
  const path = tmp.file(`db${n++}.db`);
  const first = open(path);
  first.pragma(`journal_mode = ${mode}`);
  first.exec(
    'CREATE TABLE t(id INTEGER PRIMARY KEY, v INTEGER); INSERT INTO t VALUES (1, 100), (2, 200);',
  );
  const c = [first];
  for (let i = 1; i < count; i++) c.push(open(path, { timeout: 0 }));
  first.pragma('busy_timeout = 0');
  return { path, c };
}

describe('lock states in rollback-journal mode', () => {
  test('a reader holding SHARED does not stop a writer from reaching RESERVED, but blocks its COMMIT', () => {
    const {
      c: [a, b],
    } = fresh();
    a!.exec('BEGIN');
    a!.prepare('SELECT * FROM t').all(); // SHARED
    b!.exec('BEGIN IMMEDIATE'); // RESERVED: allowed alongside SHARED
    b!.exec('UPDATE t SET v = v + 1 WHERE id = 1'); // changes stay in b's page cache
    assert.equal(
      errorCode(() => b!.exec('COMMIT')),
      'SQLITE_BUSY',
      'EXCLUSIVE needs every SHARED lock gone',
    );
    assert.equal(
      scalar(a!, 'SELECT v FROM t WHERE id = 1'),
      100,
      'reader still sees the old value',
    );
    a!.exec('COMMIT'); // reader releases SHARED
    b!.exec('COMMIT'); // the retry succeeds; the transaction stayed open after BUSY
    assert.equal(scalar(a!, 'SELECT v FROM t WHERE id = 1'), 101);
  });

  test('after a writer asks for EXCLUSIVE it holds PENDING: new readers are refused', () => {
    const {
      c: [a, b, c],
    } = fresh(3);
    a!.exec('BEGIN');
    a!.prepare('SELECT * FROM t').all();
    b!.exec('BEGIN IMMEDIATE; UPDATE t SET v = 0');
    assert.equal(
      errorCode(() => b!.exec('COMMIT')),
      'SQLITE_BUSY',
    ); // b now holds PENDING
    assert.equal(
      errorCode(() => c!.prepare('SELECT * FROM t').all()),
      'SQLITE_BUSY',
      'PENDING blocks new SHARED',
    );
    a!.exec('COMMIT');
    b!.exec('COMMIT');
    assert.equal(scalar(c!, 'SELECT sum(v) FROM t'), 0);
  });

  test('only one connection can hold RESERVED: a second BEGIN IMMEDIATE fails at once', () => {
    const {
      c: [a, b],
    } = fresh();
    a!.exec('BEGIN IMMEDIATE');
    assert.equal(
      errorCode(() => b!.exec('BEGIN IMMEDIATE')),
      'SQLITE_BUSY',
    );
    a!.exec('ROLLBACK');
    b!.exec('BEGIN IMMEDIATE; ROLLBACK');
  });

  test('BEGIN EXCLUSIVE also locks out readers in rollback mode', () => {
    const {
      c: [a, b],
    } = fresh();
    a!.exec('BEGIN EXCLUSIVE');
    assert.equal(
      errorCode(() => b!.prepare('SELECT * FROM t').all()),
      'SQLITE_BUSY',
    );
    a!.exec('COMMIT');
    assert.equal(b!.prepare('SELECT count(*) FROM t').pluck().get(), 2);
  });

  test('BEGIN (DEFERRED) takes no lock until the first read or write', () => {
    const {
      c: [a, b],
    } = fresh();
    a!.exec('BEGIN'); // nothing locked yet
    b!.exec('BEGIN EXCLUSIVE; COMMIT'); // so this succeeds
    a!.exec('COMMIT');
  });
});

describe('the deferred-upgrade deadlock', () => {
  test('two readers that both try to write: SQLite returns BUSY at once instead of waiting', () => {
    const {
      c: [a, b],
    } = fresh();
    a!.pragma('busy_timeout = 2000');
    b!.pragma('busy_timeout = 2000');
    a!.exec('BEGIN');
    a!.prepare('SELECT * FROM t').all(); // SHARED
    b!.exec('BEGIN');
    b!.prepare('SELECT * FROM t').all(); // SHARED
    a!.exec('UPDATE t SET v = 1 WHERE id = 1'); // a: RESERVED
    const t0 = performance.now();
    // b needs RESERVED, which a holds; a needs b's SHARED gone to commit. Waiting cannot help,
    // so SQLite does not invoke the busy handler for b.
    assert.equal(
      errorCode(() => b!.exec('UPDATE t SET v = 2 WHERE id = 2')),
      'SQLITE_BUSY',
    );
    assert.ok(performance.now() - t0 < 1000, 'no 2 s wait');
    b!.exec('ROLLBACK'); // the loser must roll back to release SHARED
    a!.exec('COMMIT');
  });

  test('BEGIN IMMEDIATE serialises writers across processes, and the busy timeout waits for the lock', async () => {
    const {
      path,
      c: [a],
    } = fresh(1);
    a!.exec('BEGIN IMMEDIATE'); // this process holds RESERVED
    const child = spawn(process.execPath, [
      '-e',
      `
      const D = require(${JSON.stringify(betterSqlite3Path)});
      const db = new D(process.argv[1], { timeout: 5000 });
      const t0 = Date.now();
      db.exec('BEGIN IMMEDIATE; UPDATE t SET v = v + 10 WHERE id = 2; COMMIT');
      process.stdout.write(String(Date.now() - t0));`,
      path,
    ]);
    let out = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    await delay(400); // the child is now sleeping in its busy handler
    a!.exec('UPDATE t SET v = v + 1 WHERE id = 2; COMMIT');
    const [code] = (await once(child, 'exit')) as [number];
    assert.equal(code, 0);
    assert.ok(Number(out) >= 200, `child waited ${out} ms for the lock instead of failing`);
    assert.equal(
      scalar(a!, 'SELECT v FROM t WHERE id = 2'),
      211,
      'both increments applied, serially',
    );
  });
});

describe('the rollback journal', () => {
  test('DELETE mode creates -journal during a write transaction and deletes it at commit', () => {
    const {
      path,
      c: [a],
    } = fresh(1);
    a!.exec('BEGIN; UPDATE t SET v = 0');
    assert.ok(existsSync(`${path}-journal`), 'journal exists while the transaction is open');
    a!.exec('COMMIT');
    assert.ok(!existsSync(`${path}-journal`), 'deleting the journal is the commit point');
  });

  test('TRUNCATE and PERSIST keep the file but invalidate it', () => {
    const t = fresh(1, 'TRUNCATE');
    t.c[0]!.exec('UPDATE t SET v = 0');
    assert.equal(statSync(`${t.path}-journal`).size, 0);
    const p = fresh(1, 'PERSIST');
    p.c[0]!.exec('UPDATE t SET v = 0');
    assert.ok(statSync(`${p.path}-journal`).size > 0, 'header zeroed, content left behind');
  });

  test('a hot journal left by a killed process is rolled back by the next connection', () => {
    const path = tmp.file('hot.db');
    const db = open(path);
    db.exec('CREATE TABLE big(id INTEGER PRIMARY KEY, pad TEXT)');
    const ins = db.prepare('INSERT INTO big(pad) VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 20000; i++) ins.run('a'.repeat(200));
    })();
    db.close();
    const before = readFileSync(path);
    // The child updates every row with a tiny cache, so dirty pages spill into the database file
    // before commit, then dies with SIGKILL: no rollback, no unlock, no cleanup.
    const r = spawnSync(process.execPath, [
      '-e',
      `
      const D = require(${JSON.stringify(betterSqlite3Path)});
      const db = new D(process.argv[1]);
      db.pragma('cache_size = 10');
      db.exec("BEGIN; UPDATE big SET pad = 'b' || substr(pad, 2)");
      process.kill(process.pid, 'SIGKILL');`,
      path,
    ]);
    assert.equal(r.signal, 'SIGKILL');
    assert.ok(existsSync(`${path}-journal`), 'the journal survived the crash');
    assert.notDeepEqual(
      readFileSync(path),
      before,
      'uncommitted pages really reached the database file',
    );
    const after = open(path);
    assert.equal(
      scalar(after, "SELECT count(*) FROM big WHERE pad LIKE 'b%'"),
      0,
      'no partial update visible',
    );
    assert.equal(scalar(after, 'PRAGMA integrity_check'), 'ok');
    assert.ok(!existsSync(`${path}-journal`), 'recovery removed the hot journal');
  });

  test('negative: with journal_mode=MEMORY a crash mid-transaction leaves a partial update behind', () => {
    const path = tmp.file('nojournal.db');
    const db = open(path);
    db.exec('CREATE TABLE big(id INTEGER PRIMARY KEY, pad TEXT)');
    const ins = db.prepare('INSERT INTO big(pad) VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 20000; i++) ins.run('a'.repeat(200));
    })();
    db.close();
    const r = spawnSync(process.execPath, [
      '-e',
      `
      const D = require(${JSON.stringify(betterSqlite3Path)});
      const db = new D(process.argv[1]);
      db.pragma('journal_mode = MEMORY'); // the undo log dies with the process
      db.pragma('cache_size = 10');
      db.exec("BEGIN; UPDATE big SET pad = 'b' || substr(pad, 2)");
      process.kill(process.pid, 'SIGKILL');`,
      path,
    ]);
    assert.equal(r.signal, 'SIGKILL');
    const after = open(path);
    const changed = scalar<number>(after, "SELECT count(*) FROM big WHERE pad LIKE 'b%'");
    assert.ok(changed > 0 && changed < 20000, `atomicity lost: ${changed} of 20000 rows changed`);
  });

  test('defensive builds refuse journal_mode=OFF: better-sqlite3 silently keeps DELETE', () => {
    const db = open(tmp.file('off.db'));
    assert.equal(db.pragma('journal_mode = OFF', { simple: true }), 'delete');
    assert.equal(db.pragma('journal_mode = MEMORY', { simple: true }), 'memory');
  });
});

describe('transactions inside one connection', () => {
  test('savepoints nest; ROLLBACK TO undoes part of the work and keeps the transaction', () => {
    const {
      c: [a],
    } = fresh(1);
    a!.exec(
      'BEGIN; UPDATE t SET v = 1 WHERE id = 1; SAVEPOINT s1; UPDATE t SET v = 2 WHERE id = 2;',
    );
    a!.exec('ROLLBACK TO s1; RELEASE s1; COMMIT');
    assert.deepEqual(a!.prepare('SELECT v FROM t ORDER BY id').pluck().all(), [1, 200]);
  });

  test('better-sqlite3 transaction() is DEFERRED; .immediate() issues BEGIN IMMEDIATE', () => {
    const {
      c: [a, b],
    } = fresh();
    const write = a!.transaction(() => a!.exec('UPDATE t SET v = 7'));
    b!.exec('BEGIN IMMEDIATE');
    assert.equal(
      errorCode(() => write.immediate()),
      'SQLITE_BUSY',
      'fails at BEGIN, before doing any work',
    );
    b!.exec('COMMIT');
    write.immediate();
    assert.equal(scalar(b!, 'SELECT sum(v) FROM t'), 14);
  });

  test('a statement-level error aborts the statement only; the transaction stays open', () => {
    const {
      c: [a],
    } = fresh(1);
    a!.exec('BEGIN; UPDATE t SET v = 5 WHERE id = 1');
    assert.equal(
      errorCode(() => a!.exec('INSERT INTO t VALUES (1, 0)')),
      'SQLITE_CONSTRAINT_PRIMARYKEY',
    );
    assert.equal(a!.inTransaction, true);
    a!.exec('COMMIT');
    assert.equal(scalar(a!, 'SELECT v FROM t WHERE id = 1'), 5);
  });

  test('isolation: a connection sees its own uncommitted writes; others see the committed state', () => {
    const {
      c: [a, b],
    } = fresh();
    a!.exec('BEGIN IMMEDIATE; UPDATE t SET v = 999 WHERE id = 1');
    assert.equal(scalar(a!, 'SELECT v FROM t WHERE id = 1'), 999);
    assert.equal(scalar(b!, 'SELECT v FROM t WHERE id = 1'), 100, 'readers coexist with RESERVED');
    a!.exec('ROLLBACK');
  });
});

describe('locks held by statements, ATTACH, and a retry wrapper', async () => {
  const { writeTx } = await import('./retry.ts');

  test('an unfinished iterator keeps its read transaction (and SHARED lock) open', () => {
    const {
      c: [a, b],
    } = fresh();
    const it = a!.prepare('SELECT * FROM t').iterate();
    it.next(); // stepped once, not finished: autocommit read transaction still open
    b!.exec('BEGIN IMMEDIATE; UPDATE t SET v = 0');
    assert.equal(
      errorCode(() => b!.exec('COMMIT')),
      'SQLITE_BUSY',
    );
    it.return?.(); // resets the statement, releasing SHARED
    b!.exec('COMMIT');
  });

  test('a transaction over ATTACHed databases is atomic across files in rollback mode', () => {
    const {
      c: [a],
    } = fresh(1);
    const other = tmp.file(`attached${n}.db`);
    a!.prepare('ATTACH DATABASE ? AS aux').run(other);
    a!.exec('CREATE TABLE aux.audit(msg TEXT)');
    a!.exec("BEGIN; UPDATE t SET v = 0; INSERT INTO aux.audit VALUES ('zeroed'); ROLLBACK");
    assert.equal(scalar(a!, 'SELECT sum(v) FROM t'), 300);
    assert.equal(scalar(a!, 'SELECT count(*) FROM aux.audit'), 0);
    a!.exec("BEGIN; UPDATE t SET v = 0; INSERT INTO aux.audit VALUES ('zeroed'); COMMIT");
    assert.equal(scalar(a!, 'SELECT count(*) FROM aux.audit'), 1);
  });

  test('writeTx retries BUSY by re-running the whole transaction, and gives up after N attempts', () => {
    const {
      c: [a, b],
    } = fresh();
    b!.exec('BEGIN IMMEDIATE'); // hold the write lock
    const retries: string[] = [];
    let released = false;
    const result = writeTx(
      a!,
      () => {
        a!.exec('UPDATE t SET v = v + 1 WHERE id = 1');
        return scalar<number>(a!, 'SELECT v FROM t WHERE id = 1');
      },
      {
        sleep: () => {
          if (!released) {
            b!.exec('COMMIT');
            released = true;
          }
        },
        onRetry: (_n, code) => retries.push(code),
      },
    );
    assert.deepEqual(retries, ['SQLITE_BUSY']);
    assert.equal(result, 101);

    b!.exec('BEGIN IMMEDIATE');
    assert.throws(() => writeTx(a!, () => 0, { attempts: 3, sleep: () => {} }), {
      code: 'SQLITE_BUSY',
    });
    b!.exec('ROLLBACK');
  });

  test('negative: non-retryable errors are not retried and leave no transaction open', () => {
    const {
      c: [a],
    } = fresh(1);
    let calls = 0;
    assert.throws(
      () =>
        writeTx(a!, () => {
          calls++;
          a!.exec('INSERT INTO t VALUES (1, 0)');
        }),
      { code: 'SQLITE_CONSTRAINT_PRIMARYKEY' },
    );
    assert.equal(calls, 1);
    assert.equal(a!.inTransaction, false);
  });
});
