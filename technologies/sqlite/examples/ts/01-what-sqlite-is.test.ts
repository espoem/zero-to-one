// Module 01: what SQLite is, bindings, bundled versions and build-time defaults.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { connect } from '@tursodatabase/database';
import { BUNDLED, open, scalar, tempDir, errorCode } from './helpers.ts';

const tmp = tempDir();
after(() => tmp.cleanup());

describe('every binding bundles its own SQLite', () => {
  test('better-sqlite3 13.0.3 -> 3.53.4', () => {
    const db = open();
    assert.equal(scalar(db, 'SELECT sqlite_version()'), BUNDLED.betterSqlite3);
    // sqlite_source_id() pins the exact check-in: date + SHA3 hash.
    assert.match(
      scalar<string>(db, 'SELECT sqlite_source_id()'),
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [0-9a-f]{64}/,
    );
  });

  test('node:sqlite (Node 26.12.1) -> 3.54.0', () => {
    const db = new DatabaseSync(':memory:');
    const row = db.prepare('SELECT sqlite_version() AS v').get() as { v: string };
    assert.equal(row.v, BUNDLED.nodeSqlite);
    db.close();
  });

  test('@libsql/client 0.18.0 -> 3.45.1 (libSQL fork base)', async () => {
    const c = createClient({ url: ':memory:' });
    const rs = await c.execute('SELECT sqlite_version() AS v');
    assert.equal(rs.rows[0]?.['v'], BUNDLED.libsql);
    c.close();
  });

  test('@tursodatabase/database 0.8.3 -> reports 3.50.4 (compatibility target)', async () => {
    const db = await connect(':memory:');
    const row = (await db.get('SELECT sqlite_version() AS v')) as { v: string };
    assert.equal(row.v, BUNDLED.turso);
    await db.close();
  });

  test('the same 3.54 feature exists in one binding and not in another', async () => {
    // "end of month" is new in 3.54.0. Unknown modifiers make date functions return NULL.
    const node = new DatabaseSync(':memory:');
    const r = node.prepare("SELECT date('2026-02-10','end of month') AS d").get() as {
      d: string | null;
    };
    assert.equal(r.d, '2026-02-28');
    node.close();
    const b3 = open();
    assert.equal(
      scalar(b3, "SELECT date('2026-02-10','end of month')"),
      null,
      '3.53.4 does not know the modifier',
    );
  });
});

describe('the file header records which library wrote it', () => {
  test('offset 96 holds SQLITE_VERSION_NUMBER of the last writer', () => {
    const path = tmp.file('header.db');
    const db = open(path);
    db.exec('CREATE TABLE t(x); INSERT INTO t VALUES (1);');
    db.close();
    const header = readFileSync(path).subarray(0, 100);
    assert.equal(header.subarray(0, 16).toString('latin1'), 'SQLite format 3\0');
    assert.equal(header.readUInt32BE(96), 3053004); // 3.53.4 => 3*1_000_000 + 53*1000 + 4

    // Re-open and write with node:sqlite (3.54.0); the "version-valid-for" stamp follows the writer.
    const node = new DatabaseSync(path);
    node.exec('INSERT INTO t VALUES (2)');
    node.close();
    assert.equal(readFileSync(path).readUInt32BE(96), 3054000);
  });
});

describe('build-time defaults differ between bindings', () => {
  const b3Options = (): string[] =>
    open().prepare('PRAGMA compile_options').pluck().all() as string[];

  test('better-sqlite3 is compiled with DEFAULT_FOREIGN_KEYS and DQS=0', () => {
    const opts = b3Options();
    assert.ok(opts.includes('DEFAULT_FOREIGN_KEYS'));
    assert.ok(opts.includes('DQS=0'));
    assert.ok(
      opts.includes('DEFAULT_WAL_SYNCHRONOUS=1'),
      'WAL databases default to synchronous=NORMAL',
    );
    assert.equal(scalar(open(), 'PRAGMA foreign_keys'), 1);
  });

  test('node:sqlite enables foreign keys by constructor option (enableForeignKeyConstraints)', () => {
    const db = new DatabaseSync(':memory:');
    assert.deepEqual(
      { ...(db.prepare('PRAGMA foreign_keys').get() as object) },
      { foreign_keys: 1 },
    );
    db.close();
    const off = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
    assert.deepEqual(
      { ...(off.prepare('PRAGMA foreign_keys').get() as object) },
      { foreign_keys: 0 },
    );
    off.close();
  });

  test('DQS misfeature: a mistyped double-quoted identifier silently becomes a string', async () => {
    // Turso keeps the legacy behaviour; the reference SQLite build does too unless DQS is disabled.
    const t = await connect(':memory:');
    const row = (await t.get('SELECT "no_such_column" AS v')) as { v: string };
    assert.equal(row.v, 'no_such_column');
    await t.close();
  });

  test('negative: with DQS disabled the same typo is an error (better-sqlite3, node:sqlite)', () => {
    assert.equal(
      errorCode(() => open().prepare('SELECT "no_such_column"').get()),
      'SQLITE_ERROR',
    );
    const node = new DatabaseSync(':memory:');
    assert.throws(() => node.prepare('SELECT "no_such_column"').get(), /no such column/);
    node.close();
  });

  test('negative: CLI-only extensions are absent from library builds', () => {
    const db = open();
    // generate_series ships in the CLI build; diskused() (3.54) is an optional extension.
    assert.throws(() => db.prepare('SELECT * FROM generate_series(1,3)').all(), /no such table/);
    assert.throws(() => db.prepare('SELECT diskused()').get(), /no such function/);
  });
});

describe('serverless: two processes share one file with no daemon', () => {
  test('a child process reads what the parent committed', () => {
    const path = tmp.file('shared.db');
    const db = open(path);
    db.exec(
      "CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT); INSERT INTO kv VALUES ('greeting','ahoj');",
    );
    const out = execFileSync(process.execPath, [
      '-e',
      `const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1],{readOnly:true});` +
        `process.stdout.write(d.prepare("SELECT v FROM kv WHERE k='greeting'").get().v)`,
      path,
    ]).toString();
    assert.equal(out, 'ahoj');
    db.close();
  });

  test('negative: a read-only connection cannot write', () => {
    const path = tmp.file('ro.db');
    open(path).exec('CREATE TABLE t(x)');
    const ro = open(path, { readonly: true });
    assert.equal(
      errorCode(() => ro.exec('INSERT INTO t VALUES (1)')),
      'SQLITE_READONLY',
    );
  });

  test('in-memory databases are private to their connection', () => {
    const a = open(':memory:');
    a.exec('CREATE TABLE t(x)');
    const b = open(':memory:');
    assert.equal(scalar(b, "SELECT count(*) FROM sqlite_schema WHERE name='t'"), 0);
  });
});

describe('startup version gate (Module 01 § 3.2)', async () => {
  const { versionNumber, requireSqlite } = await import('./version-gate.ts');

  test('versionNumber encodes like SQLITE_VERSION_NUMBER', () => {
    assert.equal(versionNumber('3.54.1'), 3054001);
    assert.equal(versionNumber('3.9.10'), 3009010);
    assert.throws(() => versionNumber('three'), TypeError);
  });

  test('the pinned binding passes a 3.51.3 floor', () => {
    assert.equal(requireSqlite(open(), '3.51.3'), BUNDLED.betterSqlite3);
  });

  test('negative: a 3.54.0 floor rejects better-sqlite3 13.0.3', () => {
    assert.throws(() => requireSqlite(open(), '3.54.0'), /older than required 3\.54\.0/);
  });

  test('negative: denylisted versions are refused even above the floor', () => {
    const fake = { prepare: () => ({ pluck: () => ({ get: () => '3.52.0' }) }) };
    assert.throws(() => requireSqlite(fake as never, '3.40.0'), /withdrawn/);
    const old = { prepare: () => ({ pluck: () => ({ get: () => '3.45.1' }) }) };
    assert.throws(() => requireSqlite(old as never, '3.40.0'), /WAL-reset/);
  });
});
