// Module 04: the database file format, proven by decoding files that SQLite wrote.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { open, scalar, tempDir } from './helpers.ts';
import {
  parseHeader,
  decodeVarint,
  encodeVarint,
  parseBtreePage,
  parseRecord,
  parseTableLeafCell,
  localPayloadSize,
  serialTypeSize,
} from './file-format.ts';

const tmp = tempDir();
after(() => tmp.cleanup());

describe('varints', () => {
  test('known encodings: 1 byte up to 127, 2 bytes up to 16383, 9 bytes for the top of the range', () => {
    assert.deepEqual([...encodeVarint(0n)], [0x00]);
    assert.deepEqual([...encodeVarint(127n)], [0x7f]);
    assert.deepEqual([...encodeVarint(128n)], [0x81, 0x00]);
    assert.deepEqual([...encodeVarint(16383n)], [0xff, 0x7f]);
    assert.equal(encodeVarint(-1n).length, 9, 'negative rowids always take 9 bytes');
  });

  test('round trip over boundaries and a deterministic pseudo-random sample', () => {
    const samples = [
      0n,
      1n,
      127n,
      128n,
      240n,
      2287n,
      16383n,
      16384n,
      2n ** 56n - 1n,
      2n ** 56n,
      2n ** 63n - 1n,
      -(2n ** 63n),
      -1n,
    ];
    let x = 0x2545f4914f6cdd1dn; // xorshift64 seed
    for (let i = 0; i < 500; i++) {
      x ^= (x << 13n) & 0xffffffffffffffffn;
      x ^= x >> 7n;
      x ^= (x << 17n) & 0xffffffffffffffffn;
      samples.push(BigInt.asIntN(64, x));
    }
    for (const n of samples) {
      const enc = encodeVarint(n);
      const dec = decodeVarint(enc, 0);
      assert.equal(dec.value, n);
      assert.equal(dec.length, enc.length);
      assert.ok(enc.length >= 1 && enc.length <= 9);
    }
  });

  test('negative: a truncated varint is rejected', () => {
    assert.throws(() => decodeVarint(Uint8Array.from([0x81]), 0), RangeError);
  });
});

describe('the 100-byte header', () => {
  test('fields match the corresponding pragmas', () => {
    const path = tmp.file('hdr.db');
    const db = open(path);
    db.pragma('application_id = 1515474737'); // 0x5A544F31, "ZTO1"
    db.pragma('user_version = 7');
    db.exec('CREATE TABLE t(x); INSERT INTO t VALUES (1)');
    db.close();
    const h = parseHeader(readFileSync(path));
    assert.equal(h.magic, 'SQLite format 3\0');
    assert.equal(h.pageSize, 4096);
    assert.equal(h.writeVersion, 1, 'rollback-journal mode');
    assert.equal(h.textEncoding, 1, 'UTF-8');
    assert.equal(h.userVersion, 7);
    assert.equal(h.applicationId, 0x5a544f31);
    assert.equal(h.schemaFormat, 4);
    assert.equal(h.pageCount * h.pageSize, statSync(path).size);
    assert.equal(h.versionValidFor, h.changeCounter, 'header is current');
  });

  test('every DDL bumps the schema cookie; every rollback-mode commit bumps the change counter', () => {
    const path = tmp.file('cookie.db');
    const db = open(path);
    db.exec('CREATE TABLE a(x)');
    const h1 = parseHeader(readFileSync(path));
    db.exec('CREATE TABLE b(x)');
    const h2 = parseHeader(readFileSync(path));
    db.exec('INSERT INTO a VALUES (1)');
    const h3 = parseHeader(readFileSync(path));
    assert.equal(h2.schemaCookie, h1.schemaCookie + 1);
    assert.equal(h3.schemaCookie, h2.schemaCookie, 'DML leaves the cookie alone');
    assert.equal(h3.changeCounter, h2.changeCounter + 1);
    assert.equal(scalar(db, 'PRAGMA schema_version'), h3.schemaCookie);
  });

  test('switching to WAL sets the read/write version bytes to 2', () => {
    const path = tmp.file('walhdr.db');
    const db = open(path);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE t(x)');
    db.close();
    const h = parseHeader(readFileSync(path));
    assert.deepEqual([h.writeVersion, h.readVersion], [2, 2]);
  });
});

describe('B-tree pages, cells and records', () => {
  test('decode a row straight from the table B+tree leaf page', () => {
    const path = tmp.file('rec.db');
    const db = open(path);
    db.exec(`CREATE TABLE t(id INTEGER PRIMARY KEY, a INTEGER, b TEXT, c REAL, d BLOB, e);
      INSERT INTO t VALUES (42, 300, 'ahoj', 2.5, x'cafe', NULL);`);
    const root = scalar<number>(db, "SELECT rootpage FROM sqlite_schema WHERE name = 't'");
    db.close();
    const file = readFileSync(path);
    const page = parseBtreePage(file, 4096, root);
    assert.equal(page.type, 0x0d, 'leaf table page');
    assert.equal(page.cellCount, 1);
    const cell = parseTableLeafCell(file, page.cellPointers[0]!, 4096);
    assert.equal(cell.rowid, 42n, 'the INTEGER PRIMARY KEY is the cell key');
    const rec = parseRecord(file, cell.payloadStart);
    // id is stored as NULL in the record: it lives in the cell's rowid, not in the payload.
    assert.deepEqual(rec.serialTypes, [0, 2, 21, 7, 16, 0]);
    assert.deepEqual(rec.values.slice(0, 4), [null, 300n, 'ahoj', 2.5]);
    assert.deepEqual([...(rec.values[4] as Uint8Array)], [0xca, 0xfe]);
    assert.equal(rec.values[5], null);
  });

  test('small integers 0 and 1 cost zero payload bytes (serial types 8 and 9)', () => {
    const path = tmp.file('bool.db');
    const db = open(path);
    db.exec('CREATE TABLE t(a, b, c); INSERT INTO t VALUES (0, 1, 2)');
    const root = scalar<number>(db, "SELECT rootpage FROM sqlite_schema WHERE name = 't'");
    db.close();
    const file = readFileSync(path);
    const cell = parseTableLeafCell(file, parseBtreePage(file, 4096, root).cellPointers[0]!, 4096);
    assert.deepEqual(parseRecord(file, cell.payloadStart).serialTypes, [8, 9, 1]);
    assert.deepEqual([8, 9, 1].map(serialTypeSize), [0, 0, 1]);
  });

  test('a growing table splits: the root becomes an interior page with a right-most pointer', () => {
    const path = tmp.file('split.db');
    const db = open(path);
    db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, pad TEXT)');
    const ins = db.prepare('INSERT INTO t(pad) VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 2000; i++) ins.run('x'.repeat(100));
    })();
    const root = scalar<number>(db, "SELECT rootpage FROM sqlite_schema WHERE name = 't'");
    const depth = scalar<number>(
      db,
      "SELECT count(DISTINCT path_depth) FROM (SELECT length(path) - length(replace(path, '/', '')) AS path_depth FROM dbstat WHERE name = 't')",
    );
    db.close();
    const page = parseBtreePage(readFileSync(path), 4096, root);
    assert.equal(page.type, 0x05, 'interior table page');
    assert.ok(page.rightMostPointer !== undefined && page.rightMostPointer > 1);
    assert.ok(depth >= 2, 'at least root + leaves');
  });

  test('index B-tree pages hold (key, rowid) records and have their own page type', () => {
    const path = tmp.file('idx.db');
    const db = open(path);
    db.exec(
      "CREATE TABLE t(email TEXT); CREATE INDEX t_email ON t(email); INSERT INTO t VALUES ('b@x'), ('a@x')",
    );
    const root = scalar<number>(db, "SELECT rootpage FROM sqlite_schema WHERE name = 't_email'");
    db.close();
    const file = readFileSync(path);
    const page = parseBtreePage(file, 4096, root);
    assert.equal(page.type, 0x0a, 'leaf index page');
    // Index leaf cell: varint payload size, then the record (email, rowid). Cells are in key order.
    const first = page.cellPointers[0]!;
    const len = decodeVarint(file, first);
    const rec = parseRecord(file, first + len.length);
    assert.deepEqual(rec.values, ['a@x', 2n]);
  });
});

describe('overflow pages', () => {
  test('a payload larger than U-35 keeps a computed prefix locally and chains the rest', () => {
    const path = tmp.file('ovfl.db');
    const db = open(path);
    db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, data BLOB)');
    db.prepare('INSERT INTO t VALUES (1, ?)').run(Buffer.alloc(10_000, 7));
    const root = scalar<number>(db, "SELECT rootpage FROM sqlite_schema WHERE name = 't'");
    const overflowPages = db
      .prepare(
        "SELECT pageno FROM dbstat WHERE name = 't' AND pagetype = 'overflow' ORDER BY pageno",
      )
      .pluck()
      .all() as number[];
    db.close();
    const file = readFileSync(path);
    const cell = parseTableLeafCell(file, parseBtreePage(file, 4096, root).cellPointers[0]!, 4096);
    assert.ok(cell.payloadSize > 10_000);
    assert.equal(cell.local, localPayloadSize(cell.payloadSize, 4096));
    assert.ok(cell.local < 4096 - 35);
    assert.ok(cell.overflowPage !== undefined && overflowPages.includes(cell.overflowPage));
    // Each overflow page carries U-4 bytes of payload after a 4-byte next-page pointer.
    assert.equal(overflowPages.length, Math.ceil((cell.payloadSize - cell.local) / (4096 - 4)));
  });

  test('the local-size formula: below the threshold everything is local', () => {
    assert.equal(localPayloadSize(4061, 4096), 4061);
    assert.equal(localPayloadSize(4062, 4096), 489, 'M = (U-12)*32/255 - 23 = 489');
  });
});

describe('free pages, VACUUM and auto_vacuum', () => {
  test('DELETE leaves pages on the freelist; VACUUM rebuilds and shrinks the file', () => {
    const path = tmp.file('vac.db');
    const db = open(path);
    db.exec('CREATE TABLE t(pad TEXT)');
    const ins = db.prepare('INSERT INTO t VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 3000; i++) ins.run('y'.repeat(200));
    })();
    const before = statSync(path).size;
    db.exec('DELETE FROM t');
    assert.equal(statSync(path).size, before, 'DELETE does not shrink the file');
    const free = scalar<number>(db, 'PRAGMA freelist_count');
    assert.ok(free > 100);
    assert.equal(parseHeader(readFileSync(path)).freelistCount, free);
    db.exec('VACUUM');
    assert.equal(scalar(db, 'PRAGMA freelist_count'), 0);
    assert.ok(statSync(path).size < before / 10);
  });

  test('auto_vacuum=INCREMENTAL returns free pages on demand with incremental_vacuum(N)', () => {
    const path = tmp.file('incr.db');
    const db = open(path);
    db.pragma('auto_vacuum = INCREMENTAL'); // must be set before the first table is created
    db.exec('CREATE TABLE t(pad TEXT)');
    const ins = db.prepare('INSERT INTO t VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 2000; i++) ins.run('z'.repeat(200));
    })();
    db.exec('DELETE FROM t');
    const free = scalar<number>(db, 'PRAGMA freelist_count');
    db.exec('PRAGMA incremental_vacuum(10)');
    assert.equal(scalar(db, 'PRAGMA freelist_count'), free - 10);
    assert.equal(parseHeader(readFileSync(path)).incrementalVacuum, 1);
  });

  test('negative: changing auto_vacuum after tables exist needs a VACUUM to take effect', () => {
    const path = tmp.file('late.db');
    const db = open(path);
    db.exec('CREATE TABLE t(x)');
    db.pragma('auto_vacuum = FULL');
    assert.equal(scalar(db, 'PRAGMA auto_vacuum'), 0, 'still NONE');
    db.exec('VACUUM');
    assert.equal(scalar(db, 'PRAGMA auto_vacuum'), 1, 'FULL after VACUUM');
  });

  test('page_size changes only via VACUUM, and never while in WAL mode', () => {
    const path = tmp.file('ps.db');
    const db = open(path);
    db.exec('CREATE TABLE t(x)');
    db.pragma('page_size = 8192');
    assert.equal(scalar(db, 'PRAGMA page_size'), 4096);
    db.exec('VACUUM');
    assert.equal(scalar(db, 'PRAGMA page_size'), 8192);
    db.pragma('journal_mode = WAL');
    db.pragma('page_size = 16384');
    db.exec('VACUUM');
    assert.equal(scalar(db, 'PRAGMA page_size'), 8192, 'ignored in WAL mode');
  });
});

describe('dbstat: space accounting from SQL', () => {
  test('per-object page counts and payload sum match PRAGMA page_count', () => {
    const db = open(tmp.file('stat.db'));
    db.exec('CREATE TABLE t(a TEXT); CREATE INDEX t_a ON t(a)');
    const ins = db.prepare('INSERT INTO t VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 1000; i++) ins.run(`row-${i}`.padEnd(50, '.'));
    })();
    const total = scalar<number>(db, 'SELECT count(*) FROM dbstat');
    assert.equal(
      total,
      scalar<number>(db, 'PRAGMA page_count') - scalar<number>(db, 'PRAGMA freelist_count'),
    );
    const perObject = db
      .prepare(
        'SELECT name, count(*) AS pages, sum(payload) AS payload FROM dbstat GROUP BY name ORDER BY name',
      )
      .all() as { name: string; pages: number; payload: number }[];
    const names = perObject.map((r) => r.name);
    assert.deepEqual(names, ['sqlite_schema', 't', 't_a']);
    assert.ok(perObject.every((r) => r.pages >= 1));
  });
});
