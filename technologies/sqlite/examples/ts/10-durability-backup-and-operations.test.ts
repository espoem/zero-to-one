// Module 10: backups of live databases, integrity checks, corruption, migrations, changesets.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { openSync, writeSync, closeSync, readFileSync } from 'node:fs';
import { DatabaseSync, backup as nodeBackup } from 'node:sqlite';
import Database from 'better-sqlite3';
import { open, scalar, errorCode, tempDir } from './helpers.ts';
import { migrate, type Migration } from './migrate.ts';

const tmp = tempDir();
after(() => tmp.cleanup());

function liveDb(name: string) {
  const db = open(tmp.file(name));
  db.pragma('journal_mode = WAL');
  db.pragma('wal_autocheckpoint = 0'); // keep recent commits in the WAL, as on a busy server
  db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)');
  const ins = db.prepare('INSERT INTO t(v) VALUES (?)');
  db.transaction(() => {
    for (let i = 0; i < 2000; i++) ins.run('x'.repeat(100));
  })();
  return db;
}

describe('backing up a live database', () => {
  test('VACUUM INTO writes a compact, consistent snapshot that includes WAL-only commits', () => {
    const db = liveDb('vi.db');
    const dest = tmp.file('vi-copy.db');
    db.prepare('VACUUM INTO ?').run(dest);
    const copy = open(dest);
    assert.equal(scalar(copy, 'SELECT count(*) FROM t'), 2000);
    assert.equal(scalar(copy, 'PRAGMA integrity_check'), 'ok');
    assert.equal(
      copy.pragma('journal_mode', { simple: true }),
      'delete',
      'the copy is a self-contained file',
    );
  });

  test('negative: VACUUM INTO refuses to overwrite an existing non-empty file', () => {
    const db = liveDb('vi2.db');
    const dest = tmp.file('vi2-copy.db');
    db.prepare('VACUUM INTO ?').run(dest);
    assert.throws(() => db.prepare('VACUUM INTO ?').run(dest), /output file already exists/);
  });

  test('the online backup API copies pages incrementally while the source keeps accepting writes', async () => {
    const db = liveDb('bk.db');
    const writer = open(db.name);
    const dest = tmp.file('bk-copy.db');
    let steps = 0;
    await db.backup(dest, {
      progress: () => {
        // One concurrent write from another connection after the first step. A write from another
        // connection restarts the backup, so writing on every step would never let it finish.
        if (steps++ === 0) writer.prepare('INSERT INTO t(v) VALUES (?)').run('during backup');
        return 5; // pages per step: small steps release the source lock in between
      },
    });
    assert.ok(steps > 1);
    const copy = open(dest);
    assert.equal(scalar(copy, 'PRAGMA integrity_check'), 'ok');
    assert.ok(scalar<number>(copy, 'SELECT count(*) FROM t') >= 2000);
  });

  test('node:sqlite has the same backup API', async () => {
    const path = tmp.file('nodebk.db');
    const src = new DatabaseSync(path);
    src.exec("CREATE TABLE t(x); INSERT INTO t VALUES ('a'), ('b')");
    const pages = await nodeBackup(src, tmp.file('nodebk-copy.db'));
    assert.ok(pages >= 1);
    const copy = new DatabaseSync(tmp.file('nodebk-copy.db'));
    assert.equal((copy.prepare('SELECT count(*) AS n FROM t').get() as { n: number }).n, 2);
    src.close();
    copy.close();
  });

  test('serialize() snapshots a database into memory; a Buffer can be opened as a database', () => {
    const db = liveDb('ser.db');
    // A serialized WAL database keeps the WAL flag in its header and cannot be opened from memory,
    // so switch to rollback mode first (this also checkpoints the WAL into the image).
    db.pragma('journal_mode = DELETE');
    const image = db.serialize();
    const mem = new Database(image);
    assert.equal(mem.prepare('SELECT count(*) FROM t').pluck().get(), 2000);
  });
});

describe('integrity checks and corruption', () => {
  test('a healthy database passes integrity_check and quick_check', () => {
    const db = liveDb('ok.db');
    assert.equal(scalar(db, 'PRAGMA integrity_check'), 'ok');
    assert.equal(scalar(db, 'PRAGMA quick_check'), 'ok');
  });

  test('negative: bytes overwritten outside SQLite are detected as corruption', () => {
    const path = tmp.file('bad.db');
    const db = open(path);
    db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT); CREATE INDEX t_v ON t(v)');
    const ins = db.prepare('INSERT INTO t(v) VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 2000; i++) ins.run(`value-${i}`);
    })();
    const idxRoot = scalar<number>(db, "SELECT rootpage FROM sqlite_schema WHERE name = 't_v'");
    const leaf = scalar<number>(
      db,
      "SELECT pageno FROM dbstat WHERE name = 't_v' AND pagetype = 'leaf' LIMIT 1",
    );
    db.close();
    // Simulate a stray write (another program, a bad disk, a buggy backup tool): zero part of an index page.
    const fd = openSync(path, 'r+');
    writeSync(fd, Buffer.alloc(512, 0), 0, 512, (leaf - 1) * 4096 + 1024);
    closeSync(fd);
    const after = open(path);
    const report = after.prepare('PRAGMA integrity_check').pluck().all() as string[];
    assert.notDeepEqual(report, ['ok']);
    assert.ok(idxRoot > 0);
    // Index-only damage can be repaired: REINDEX rebuilds the index from the table.
    after.exec('REINDEX t_v');
    assert.equal(scalar(after, 'PRAGMA integrity_check'), 'ok');
  });

  test('PRAGMA data_version changes when another connection commits', () => {
    const db = liveDb('dv.db');
    const other = open(db.name);
    const before = scalar<number>(db, 'PRAGMA data_version');
    other.exec("INSERT INTO t(v) VALUES ('x')");
    assert.notEqual(scalar(db, 'PRAGMA data_version'), before);
    const own = scalar<number>(db, 'PRAGMA data_version');
    db.exec("INSERT INTO t(v) VALUES ('y')");
    assert.equal(scalar(db, 'PRAGMA data_version'), own, 'own commits do not change it');
  });
});

describe('migrations with user_version', () => {
  const migrations: Migration[] = [
    (db) =>
      db.exec('CREATE TABLE customer(id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE) STRICT'),
    (db) => db.exec('ALTER TABLE customer ADD COLUMN name TEXT'),
    (db) => db.exec('CREATE INDEX customer_name ON customer(name)'),
  ];

  test('applies pending migrations in order, once', () => {
    const db = open(tmp.file('mig.db'));
    assert.equal(migrate(db, migrations), 3);
    assert.equal(migrate(db, migrations), 3, 'idempotent');
    assert.equal(scalar(db, "SELECT count(*) FROM pragma_table_info('customer')"), 3);
  });

  test('negative: a failing migration rolls back with its version bump', () => {
    const db = open(tmp.file('mig-fail.db'));
    const broken: Migration[] = [
      ...migrations,
      (d) => d.exec('ALTER TABLE customer ADD COLUMN x TEXT; CREATE TABLE oops('),
    ];
    assert.throws(() => migrate(db, broken), /incomplete input|syntax error/);
    assert.equal(scalar(db, 'PRAGMA user_version'), 3);
    assert.equal(
      scalar(db, "SELECT count(*) FROM pragma_table_info('customer') WHERE name = 'x'"),
      0,
    );
  });

  test('negative: refuses to run old code against a newer database', () => {
    const db = open(tmp.file('mig-new.db'));
    db.pragma('user_version = 9');
    assert.throws(() => migrate(db, migrations), /newer than this code/);
  });
});

describe('the session extension: changesets (node:sqlite)', () => {
  test('record changes on one database and replay them on another', () => {
    const schema = 'CREATE TABLE item(id INTEGER PRIMARY KEY, name TEXT, qty INTEGER)';
    const a = new DatabaseSync(':memory:');
    a.exec(schema);
    a.exec("INSERT INTO item VALUES (1, 'apple', 5)");
    const b = new DatabaseSync(':memory:');
    b.exec(schema);
    b.exec("INSERT INTO item VALUES (1, 'apple', 5)");
    const session = a.createSession({ table: 'item' });
    a.exec("UPDATE item SET qty = 7 WHERE id = 1; INSERT INTO item VALUES (2, 'pear', 1)");
    const changeset = session.changeset();
    assert.ok(changeset.length > 0);
    assert.equal(b.applyChangeset(changeset), true);
    assert.deepEqual(
      b
        .prepare('SELECT id, qty FROM item ORDER BY id')
        .all()
        .map((r) => ({ ...r })),
      [
        { id: 1, qty: 7 },
        { id: 2, qty: 1 },
      ],
    );
  });

  test('negative: a conflicting target makes applyChangeset abort by default', () => {
    const schema = 'CREATE TABLE item(id INTEGER PRIMARY KEY, qty INTEGER)';
    const a = new DatabaseSync(':memory:');
    a.exec(schema);
    a.exec('INSERT INTO item VALUES (1, 5)');
    const b = new DatabaseSync(':memory:');
    b.exec(schema);
    b.exec('INSERT INTO item VALUES (1, 99)'); // diverged
    const session = a.createSession();
    a.exec('UPDATE item SET qty = 6 WHERE id = 1');
    assert.equal(
      b.applyChangeset(session.changeset()),
      false,
      'old value 5 does not match 99: aborted',
    );
    assert.equal((b.prepare('SELECT qty FROM item').get() as { qty: number }).qty, 99);
  });
});

test('negative: deleting -wal of a live database loses committed transactions', () => {
  const db = liveDb('del.db');
  db.exec("CREATE TABLE important(x); INSERT INTO important VALUES ('committed')");
  const mainOnly = readFileSync(db.name);
  // Equivalent to: process crashed, then someone "cleaned up" the -wal file before restart.
  const restored = tmp.file('del-restored.db');
  const fd = openSync(restored, 'w');
  writeSync(fd, mainOnly);
  closeSync(fd);
  assert.equal(
    errorCode(() => open(restored).prepare('SELECT * FROM important').all()),
    'SQLITE_ERROR',
  );
});
