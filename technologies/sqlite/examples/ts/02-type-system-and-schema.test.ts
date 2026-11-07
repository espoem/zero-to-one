// Module 02: storage classes, affinity, STRICT, rowid, constraints and foreign keys.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { open, scalar, errorCode } from './helpers.ts';

const typesOf = (db: ReturnType<typeof open>, sql: string) =>
  db.prepare(sql).raw().all() as unknown[][];

describe('affinity is derived from the declared type name by five ordered rules', () => {
  test('rule order: INT, then CHAR/CLOB/TEXT, then BLOB/none, then REAL/FLOA/DOUB, else NUMERIC', () => {
    const db = open();
    db.exec(`CREATE TABLE a(
      i BIGINT, t VARCHAR(3), b BLOB, n, r DOUBLE PRECISION, num DECIMAL(10,2),
      s STRING, fp FLOATING POINT, any_ ANY)`);
    // VARCHAR(3) does not truncate; the length is ignored.
    db.prepare('INSERT INTO a VALUES (?,?,?,?,?,?,?,?,?)').run(
      '42',
      'toolong',
      '42',
      '42',
      '42',
      '42',
      '0123',
      '1.5',
      '0123',
    );
    const row = db
      .prepare(`SELECT typeof(i), typeof(t), length(t), typeof(b), typeof(n), typeof(r),
      typeof(num), s, typeof(s), fp, typeof(fp), any_, typeof(any_) FROM a`)
      .raw()
      .get();
    assert.deepEqual(row, [
      'integer',
      'text',
      7,
      'text',
      'text',
      'real',
      'integer', // DECIMAL -> NUMERIC affinity: '42' becomes integer 42
      123,
      'integer', // STRING matches no rule -> NUMERIC: leading zero lost
      1.5,
      'real', // FLOATING POINT contains "INT" -> INTEGER affinity, 1.5 stays REAL
      123,
      'integer', // ANY in an ordinary table is just NUMERIC affinity
    ]);
  });

  test('NUMERIC affinity stores 3.0 as integer 3, but keeps 3.5 as real', () => {
    const db = open();
    db.exec(
      "CREATE TABLE n(x NUMERIC); INSERT INTO n VALUES ('3.0'), (3.0), ('3.5'), ('1e3'), ('abc')",
    );
    assert.deepEqual(typesOf(db, 'SELECT x, typeof(x) FROM n'), [
      [3, 'integer'],
      [3, 'integer'],
      [3.5, 'real'],
      [1000, 'integer'],
      ['abc', 'text'],
    ]);
  });

  test('negative: an ordinary INTEGER column happily stores text', () => {
    const db = open();
    db.exec("CREATE TABLE t(n INTEGER); INSERT INTO t VALUES ('abc'), (x'00ff'), (1.5)");
    assert.deepEqual(typesOf(db, 'SELECT typeof(n) FROM t').flat(), ['text', 'blob', 'real']);
  });
});

describe('comparison follows storage-class order and operand affinity', () => {
  test('NULL < INTEGER/REAL < TEXT < BLOB when no affinity applies', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT '10' > 9"), 1, 'any TEXT is greater than any number');
    assert.equal(scalar(db, "SELECT x'00' > 'zzz'"), 1, 'any BLOB is greater than any TEXT');
  });

  test('a column with INTEGER affinity converts the text operand before comparing', () => {
    const db = open();
    db.exec("CREATE TABLE c(n INTEGER, t TEXT); INSERT INTO c VALUES (10, '10')");
    assert.equal(scalar(db, "SELECT n = '10' FROM c"), 1, 'text literal gets INTEGER affinity');
    assert.equal(scalar(db, 'SELECT t = 10 FROM c'), 1, 'numeric literal gets TEXT affinity');
    assert.equal(scalar(db, "SELECT '10' = 10"), 0, 'two literals: no conversion');
  });

  test('integer arithmetic: truncating division and overflow to REAL', () => {
    const db = open();
    assert.equal(scalar(db, 'SELECT 5 / 2'), 2);
    assert.equal(scalar(db, 'SELECT 5 / 2.0'), 2.5);
    assert.equal(scalar(db, 'SELECT typeof(9223372036854775807 + 1)'), 'real');
    assert.equal(scalar(db, 'SELECT 0.1 + 0.2 = 0.3'), 0);
    assert.equal(scalar(db, 'SELECT 1 / 0'), null, 'division by zero yields NULL, not an error');
  });

  test('NOCASE folds ASCII only', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT 'ABC' = 'abc' COLLATE NOCASE"), 1);
    assert.equal(scalar(db, "SELECT 'É' = 'é' COLLATE NOCASE"), 0);
    assert.equal(scalar(db, "SELECT 'a  ' = 'a' COLLATE RTRIM"), 1);
  });
});

describe('STRICT tables', () => {
  test('reject values that cannot be losslessly coerced, with SQLITE_CONSTRAINT_DATATYPE', () => {
    const db = open();
    db.exec(
      'CREATE TABLE s(id INTEGER PRIMARY KEY, n INTEGER, r REAL, t TEXT, b BLOB, a ANY) STRICT',
    );
    assert.equal(
      errorCode(() => db.prepare('INSERT INTO s(n) VALUES (?)').run('abc')),
      'SQLITE_CONSTRAINT_DATATYPE',
    );
    assert.equal(
      errorCode(() => db.prepare('INSERT INTO s(n) VALUES (?)').run(1.5)),
      'SQLITE_CONSTRAINT_DATATYPE',
    );
  });

  test('still coerce losslessly: text 42 to INTEGER, integer to REAL; ANY keeps the value as given', () => {
    const db = open();
    db.exec('CREATE TABLE s(n INTEGER, r REAL, a ANY) STRICT');
    db.prepare('INSERT INTO s VALUES (?,?,?)').run('42', 7, '0123');
    assert.deepEqual(
      db.prepare('SELECT n, typeof(n), r, typeof(r), a, typeof(a) FROM s').raw().get(),
      [42, 'integer', 7, 'real', '0123', 'text'],
    );
  });

  test('negative: unknown type names are rejected at CREATE time', () => {
    const db = open();
    assert.throws(() => db.exec('CREATE TABLE s(d DATETIME) STRICT'), /unknown datatype/);
  });

  test('PRIMARY KEY columns are NOT NULL in STRICT tables, unlike ordinary rowid tables', () => {
    const db = open();
    db.exec(
      'CREATE TABLE loose(k TEXT PRIMARY KEY); CREATE TABLE tight(k TEXT PRIMARY KEY) STRICT',
    );
    db.exec('INSERT INTO loose VALUES (NULL), (NULL)'); // legacy bug kept for compatibility
    assert.equal(scalar(db, 'SELECT count(*) FROM loose WHERE k IS NULL'), 2);
    assert.equal(
      errorCode(() => db.exec('INSERT INTO tight VALUES (NULL)')),
      'SQLITE_CONSTRAINT_NOTNULL',
    );
  });
});

describe('rowid, INTEGER PRIMARY KEY and AUTOINCREMENT', () => {
  test('only the exact spelling INTEGER PRIMARY KEY aliases the rowid', () => {
    const db = open();
    db.exec('CREATE TABLE a(id INTEGER PRIMARY KEY, v); CREATE TABLE b(id INT PRIMARY KEY, v)');
    db.exec("INSERT INTO a(v) VALUES ('x'); INSERT INTO b(id, v) VALUES (100, 'x')");
    assert.equal(scalar(db, 'SELECT id = rowid FROM a'), 1);
    assert.equal(
      scalar(db, 'SELECT rowid FROM b'),
      1,
      'INT PRIMARY KEY is a separate unique index',
    );
    assert.equal(
      scalar(db, "SELECT count(*) FROM sqlite_schema WHERE type='index' AND tbl_name='b'"),
      1,
    );
    assert.equal(
      scalar(db, "SELECT count(*) FROM sqlite_schema WHERE type='index' AND tbl_name='a'"),
      0,
    );
  });

  test('without AUTOINCREMENT the largest rowid is reused after delete', () => {
    const db = open();
    db.exec(
      "CREATE TABLE t(id INTEGER PRIMARY KEY, v); INSERT INTO t(v) VALUES ('a'),('b'),('c'); DELETE FROM t WHERE id = 3",
    );
    assert.equal(db.prepare("INSERT INTO t(v) VALUES ('d')").run().lastInsertRowid, 3);
  });

  test('AUTOINCREMENT never reuses, and records the high-water mark in sqlite_sequence', () => {
    const db = open();
    db.exec(
      "CREATE TABLE t(id INTEGER PRIMARY KEY AUTOINCREMENT, v); INSERT INTO t(v) VALUES ('a'),('b'),('c'); DELETE FROM t WHERE id = 3",
    );
    assert.equal(db.prepare("INSERT INTO t(v) VALUES ('d')").run().lastInsertRowid, 4);
    assert.equal(scalar(db, "SELECT seq FROM sqlite_sequence WHERE name = 't'"), 4);
  });

  test('at the maximum rowid: plain tables pick a random unused rowid, AUTOINCREMENT fails with SQLITE_FULL', () => {
    const db = open();
    db.defaultSafeIntegers(true);
    db.exec('CREATE TABLE p(id INTEGER PRIMARY KEY); INSERT INTO p VALUES (9223372036854775807)');
    const next = db.prepare('INSERT INTO p VALUES (NULL)').run().lastInsertRowid as bigint;
    assert.ok(next > 0n && next < 9223372036854775807n);
    db.exec(
      'CREATE TABLE q(id INTEGER PRIMARY KEY AUTOINCREMENT); INSERT INTO q VALUES (9223372036854775807)',
    );
    assert.equal(
      errorCode(() => db.exec('INSERT INTO q VALUES (NULL)')),
      'SQLITE_FULL',
    );
  });

  test('WITHOUT ROWID requires a PRIMARY KEY, enforces NOT NULL, and has no rowid', () => {
    const db = open();
    assert.throws(() => db.exec('CREATE TABLE w(a) WITHOUT ROWID'), /PRIMARY KEY missing/);
    db.exec('CREATE TABLE w(k TEXT PRIMARY KEY, v) WITHOUT ROWID');
    assert.equal(
      errorCode(() => db.exec('INSERT INTO w VALUES (NULL, 1)')),
      'SQLITE_CONSTRAINT_NOTNULL',
    );
    assert.throws(() => db.prepare('SELECT rowid FROM w').get(), /no such column: rowid/);
  });
});

describe('constraints and generated columns', () => {
  test('UNIQUE allows many NULLs; CHECK and NOT NULL report distinct extended codes', () => {
    const db = open();
    db.exec('CREATE TABLE u(e TEXT UNIQUE, qty INTEGER NOT NULL CHECK (qty >= 0))');
    db.exec('INSERT INTO u VALUES (NULL, 1), (NULL, 2)');
    assert.equal(
      errorCode(() => db.exec('INSERT INTO u VALUES (NULL, -1)')),
      'SQLITE_CONSTRAINT_CHECK',
    );
    assert.equal(
      errorCode(() => db.exec('INSERT INTO u VALUES (NULL, NULL)')),
      'SQLITE_CONSTRAINT_NOTNULL',
    );
    db.exec("INSERT INTO u VALUES ('a@x', 1)");
    assert.equal(
      errorCode(() => db.exec("INSERT INTO u VALUES ('a@x', 1)")),
      'SQLITE_CONSTRAINT_UNIQUE',
    );
  });

  test('conflict clauses: INSERT OR IGNORE / OR REPLACE change what a violation does', () => {
    const db = open();
    db.exec("CREATE TABLE k(id INTEGER PRIMARY KEY, v); INSERT INTO k VALUES (1, 'a')");
    assert.equal(db.prepare("INSERT OR IGNORE INTO k VALUES (1, 'b')").run().changes, 0);
    db.exec("INSERT OR REPLACE INTO k VALUES (1, 'c')"); // deletes the old row, then inserts
    assert.equal(scalar(db, 'SELECT v FROM k WHERE id = 1'), 'c');
  });

  test('VIRTUAL and STORED generated columns; STORED cannot be added by ALTER TABLE', () => {
    const db = open();
    db.exec(`CREATE TABLE g(price REAL, qty INTEGER,
      total REAL GENERATED ALWAYS AS (price * qty) STORED,
      label TEXT AS ('x' || qty) VIRTUAL)`);
    db.exec('INSERT INTO g(price, qty) VALUES (2.5, 4)');
    assert.deepEqual(db.prepare('SELECT total, label FROM g').raw().get(), [10, 'x4']);
    assert.throws(
      () => db.exec('INSERT INTO g(price, qty, total) VALUES (1, 1, 1)'),
      /generated column/,
    );
    assert.throws(
      () => db.exec('ALTER TABLE g ADD COLUMN t2 AS (qty * 2) STORED'),
      /cannot add a STORED column/,
    );
    db.exec('ALTER TABLE g ADD COLUMN t3 AS (qty * 3) VIRTUAL');
    assert.equal(scalar(db, 'SELECT t3 FROM g'), 12);
  });
});

describe('foreign keys', () => {
  const schema = `CREATE TABLE parent(id INTEGER PRIMARY KEY);
    CREATE TABLE child(id INTEGER PRIMARY KEY, pid INTEGER REFERENCES parent(id) ON DELETE CASCADE);`;

  test('negative: with foreign_keys=OFF a dangling reference is accepted silently', () => {
    const db = open();
    db.pragma('foreign_keys = OFF');
    db.exec(schema);
    db.exec('INSERT INTO child VALUES (1, 999)');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').raw().all(), [
      ['child', 1, 'parent', 0],
    ]);
  });

  test('with foreign_keys=ON the insert fails and ON DELETE CASCADE runs', () => {
    const db = open();
    db.pragma('foreign_keys = ON');
    db.exec(schema);
    assert.equal(
      errorCode(() => db.exec('INSERT INTO child VALUES (1, 999)')),
      'SQLITE_CONSTRAINT_FOREIGNKEY',
    );
    db.exec(
      'INSERT INTO parent VALUES (1); INSERT INTO child VALUES (1, 1); DELETE FROM parent WHERE id = 1',
    );
    assert.equal(scalar(db, 'SELECT count(*) FROM child'), 0);
  });

  test('PRAGMA foreign_keys is a no-op inside a transaction', () => {
    const db = open();
    db.pragma('foreign_keys = ON');
    db.exec('BEGIN');
    db.pragma('foreign_keys = OFF');
    assert.equal(scalar(db, 'PRAGMA foreign_keys'), 1);
    db.exec('COMMIT');
  });

  test('DEFERRABLE INITIALLY DEFERRED checks at COMMIT, so insertion order inside a transaction is free', () => {
    const db = open();
    db.exec(`CREATE TABLE p(id INTEGER PRIMARY KEY);
      CREATE TABLE c(pid INTEGER REFERENCES p(id) DEFERRABLE INITIALLY DEFERRED);`);
    db.exec('BEGIN; INSERT INTO c VALUES (7); INSERT INTO p VALUES (7); COMMIT');
    db.exec('BEGIN; INSERT INTO c VALUES (8)');
    assert.equal(
      errorCode(() => db.exec('COMMIT')),
      'SQLITE_CONSTRAINT_FOREIGNKEY',
    );
    db.exec('ROLLBACK');
  });

  test('negative: the parent key must be PRIMARY KEY or UNIQUE, or every child write fails', () => {
    const db = open();
    db.exec('CREATE TABLE p(code TEXT); CREATE TABLE c(code TEXT REFERENCES p(code))');
    assert.throws(() => db.exec("INSERT INTO c VALUES ('x')"), /foreign key mismatch/);
  });
});

describe('large integers across the JavaScript boundary', () => {
  test('negative: by default better-sqlite3 silently rounds to a double; safeIntegers returns BigInt', () => {
    const db = open();
    db.exec('CREATE TABLE b(n INTEGER); INSERT INTO b VALUES (9007199254740993)'); // 2^53 + 1
    const lossy = db.prepare('SELECT n FROM b').pluck().get();
    assert.equal(lossy, 9007199254740992, 'off by one, no error');
    const v = db.prepare('SELECT n FROM b').safeIntegers(true).pluck().get();
    assert.equal(v, 9007199254740993n);
  });
});
