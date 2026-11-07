// Module 12: libSQL (the C fork) and Turso Database (the Rust rewrite), proven locally.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { connect, type Database } from '@tursodatabase/database';
import { BUNDLED, tempDir } from './helpers.ts';

const tmp = tempDir();
after(() => tmp.cleanup());
let n = 0;

async function libsql(): Promise<Client> {
  const c = createClient({ url: `file:${tmp.file(`libsql${n++}.db`)}` });
  assert.equal((await c.execute('SELECT sqlite_version() AS v')).rows[0]?.['v'], BUNDLED.libsql);
  return c;
}
const one = async (c: Client, sql: string) => (await c.execute(sql)).rows[0]?.['r'];

describe('libSQL (@libsql/client 0.18.0, SQLite 3.45.1 base)', () => {
  test('has 3.45-era features: STRICT tables and JSONB', async () => {
    const c = await libsql();
    await c.execute('CREATE TABLE s(n INTEGER) STRICT');
    await assert.rejects(
      c.execute("INSERT INTO s VALUES ('abc')"),
      /cannot store TEXT value in INTEGER column/,
    );
    assert.equal(await one(c, "SELECT typeof(jsonb('[1]')) AS r"), 'blob');
  });

  test('negative: lacks every upstream change since 3.45', async () => {
    const c = await libsql();
    await assert.rejects(c.execute("SELECT json_pretty('[1]')"), /no such function: json_pretty/); // 3.46
    await assert.rejects(c.execute("SELECT iif(1, 'y')"), /wrong number of arguments/); // 3.48
    await assert.rejects(c.execute("SELECT unistr('x')"), /no such function: unistr/); // 3.50
    assert.equal(await one(c, "SELECT date('2026-02-10', 'end of month') AS r"), null); // 3.54
  });

  test('native vectors: F32_BLOB columns, a DiskANN index, and vector_top_k', async () => {
    const c = await libsql();
    await c.batch(
      [
        'CREATE TABLE doc(id INTEGER PRIMARY KEY, title TEXT, emb F32_BLOB(3))',
        'CREATE INDEX doc_emb ON doc(libsql_vector_idx(emb))',
        "INSERT INTO doc(title, emb) VALUES ('wal', vector32('[1,0,0]')), ('btree', vector32('[0,1,0]')), ('checkpoint', vector32('[0.9,0.1,0]'))",
      ],
      'write',
    );
    const knn =
      await c.execute(`SELECT d.title FROM vector_top_k('doc_emb', vector32('[1,0,0]'), 2) AS k
      JOIN doc AS d ON d.rowid = k.id`);
    assert.deepEqual(knn.rows.map((r) => r['title']).sort(), ['checkpoint', 'wal']);
    const exact = await c.execute(
      "SELECT title FROM doc ORDER BY vector_distance_cos(emb, vector32('[1,0,0]')) LIMIT 1",
    );
    assert.equal(exact.rows[0]?.['title'], 'wal');
  });

  test('negative: F32_BLOB(3) alone does not enforce the dimension; the vector index does', async () => {
    const c = await libsql();
    await c.execute('CREATE TABLE v(e F32_BLOB(3))');
    await c.execute("INSERT INTO v VALUES (vector32('[1,2]'))"); // accepted: the column type is only affinity
    assert.equal(await one(c, 'SELECT length(e) AS r FROM v'), 8, 'two float32 values');
    await c.execute('CREATE TABLE w(e F32_BLOB(3))');
    await c.execute('CREATE INDEX w_e ON w(libsql_vector_idx(e))');
    await assert.rejects(
      c.execute("INSERT INTO w VALUES (vector32('[1,2]'))"),
      /dimensions are different: 2 != 3/,
    );
    await assert.rejects(
      c.execute("SELECT vector_distance_cos(vector32('[1,2]'), vector32('[1,2,3]'))"),
      /same length/,
    );
  });

  test("batch(..., 'write') is atomic: one failing statement rolls back the whole batch", async () => {
    const c = await libsql();
    await c.execute('CREATE TABLE u(k TEXT PRIMARY KEY)');
    await assert.rejects(
      c.batch(["INSERT INTO u VALUES ('a')", "INSERT INTO u VALUES ('a')"], 'write'),
    );
    assert.equal(await one(c, 'SELECT count(*) AS r FROM u'), 0);
  });

  test("interactive transaction('write') starts with BEGIN IMMEDIATE and blocks a second writer", async () => {
    const path = tmp.file('libsql-tx.db');
    const a = createClient({ url: `file:${path}` });
    const b = createClient({ url: `file:${path}` });
    await a.execute('CREATE TABLE t(x)');
    const tx = await a.transaction('write');
    await tx.execute('INSERT INTO t VALUES (1)');
    await assert.rejects(b.execute('INSERT INTO t VALUES (2)'), /SQLITE_BUSY|database is locked/);
    await tx.commit();
    await b.execute('INSERT INTO t VALUES (2)');
    assert.equal(await one(b, 'SELECT count(*) AS r FROM t'), 2);
  });
});

async function turso(path: string): Promise<Database> {
  const db = await connect(path);
  assert.equal(((await db.get('SELECT sqlite_version() AS v')) as { v: string }).v, BUNDLED.turso);
  return db;
}

describe('Turso Database (@tursodatabase/database 0.8.3, Rust rewrite)', () => {
  test('MVCC: BEGIN CONCURRENT lets two connections commit disjoint rows at the same time', async () => {
    const path = tmp.file('mvcc.db');
    const a = await turso(path);
    assert.deepEqual(await a.all("PRAGMA journal_mode = 'mvcc'"), [{ journal_mode: 'mvcc' }]);
    await a.exec(
      'CREATE TABLE h(id INTEGER PRIMARY KEY, n INTEGER); INSERT INTO h VALUES (1, 0), (2, 0)',
    );
    const b = await turso(path);
    await a.exec('BEGIN CONCURRENT');
    await b.exec('BEGIN CONCURRENT');
    await a.exec('UPDATE h SET n = n + 1 WHERE id = 1');
    await b.exec('UPDATE h SET n = n + 1 WHERE id = 2'); // in SQLite this second writer would get SQLITE_BUSY
    await a.exec('COMMIT');
    await b.exec('COMMIT');
    assert.deepEqual(await a.all('SELECT n FROM h ORDER BY id'), [{ n: 1 }, { n: 1 }]);
  });

  test('negative: two concurrent writers to the same row conflict; the loser must roll back and retry', async () => {
    const path = tmp.file('conflict.db');
    const a = await turso(path);
    await a.exec("PRAGMA journal_mode = 'mvcc'");
    await a.exec('CREATE TABLE h(id INTEGER PRIMARY KEY, n INTEGER); INSERT INTO h VALUES (1, 0)');
    const b = await turso(path);
    await a.exec('BEGIN CONCURRENT');
    await b.exec('BEGIN CONCURRENT');
    await a.exec('UPDATE h SET n = n + 1 WHERE id = 1');
    await assert.rejects(b.exec('UPDATE h SET n = n + 1 WHERE id = 1'), /conflict/i);
    // The conflict already ended b's transaction: an explicit ROLLBACK now fails.
    await assert.rejects(b.exec('ROLLBACK'), /no transaction is active/);
    await a.exec('COMMIT');
    // The documented pattern: retry the whole transaction.
    for (let attempt = 0; ; attempt++) {
      try {
        await b.exec('BEGIN CONCURRENT');
        await b.exec('UPDATE h SET n = n + 1 WHERE id = 1');
        await b.exec('COMMIT');
        break;
      } catch (e) {
        await b.exec('ROLLBACK').catch(() => {});
        if (attempt > 5 || !/conflict|busy/i.test(String(e))) throw e;
      }
    }
    assert.deepEqual(await a.get('SELECT n FROM h WHERE id = 1'), { n: 2 }, 'no lost update');
  });

  test('built-in CDC: capture_data_changes_conn records changes in turso_cdc', async () => {
    const db = await turso(':memory:');
    await db.exec('CREATE TABLE item(id INTEGER PRIMARY KEY, name TEXT)');
    await db.exec("PRAGMA capture_data_changes_conn('full')");
    await db.exec(
      "INSERT INTO item VALUES (1, 'apple'); UPDATE item SET name = 'pear' WHERE id = 1; DELETE FROM item WHERE id = 1",
    );
    const rows = (await db.all(
      "SELECT change_type, table_name, id FROM turso_cdc WHERE table_name = 'item' ORDER BY change_id",
    )) as { change_type: number }[];
    assert.deepEqual(
      rows.map((r) => r.change_type),
      [1, 0, -1],
      'insert, update, delete',
    );
  });

  test('vector functions exist; SQLite C extensions such as FTS5 do not', async () => {
    const db = await turso(':memory:');
    assert.deepEqual(
      await db.get("SELECT vector_distance_cos(vector32('[1,0]'), vector32('[0,1]')) AS d"),
      { d: 1 },
    );
    await assert.rejects(db.exec('CREATE VIRTUAL TABLE f USING fts5(a)'), /no such module: fts5/);
  });

  test('local encryption at rest: the file has no SQLite header and no plaintext', async () => {
    const path = tmp.file('enc.db');
    const hexkey = 'b1bbfda4f589dc9daaf004fe21111e00dc00c98237102f5c7002a5669fc76327'; // test key, not a secret
    const opts = {
      experimental: ['encryption' as const],
      encryption: { cipher: 'aegis256' as const, hexkey },
    };
    const db = await connect(path, opts);
    await db.exec("CREATE TABLE s(x); INSERT INTO s VALUES ('secret-value')");
    await db.close();
    const raw = readFileSync(path);
    assert.ok(!raw.includes(Buffer.from('secret-value')));
    assert.notEqual(raw.subarray(0, 16).toString('latin1'), 'SQLite format 3\0');
    await assert.rejects(connect(path), /not a database/i);
    const again = await connect(path, opts);
    assert.deepEqual(await again.get('SELECT x FROM s'), { x: 'secret-value' });
  });
});
