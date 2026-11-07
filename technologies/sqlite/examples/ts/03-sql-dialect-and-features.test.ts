// Module 03: CTEs, window functions, UPSERT, RETURNING, JSON/JSONB, date/time, ALTER TABLE, quirks.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { open, scalar, errorCode, BUNDLED } from './helpers.ts';

const rows = (db: ReturnType<typeof open>, sql: string, ...p: unknown[]) =>
  db
    .prepare(sql)
    .raw()
    .all(...p);

describe('common table expressions', () => {
  test('a recursive CTE walks a hierarchy breadth-first with a depth counter', () => {
    const db = open();
    db.exec(`CREATE TABLE emp(id INTEGER PRIMARY KEY, name TEXT, boss INTEGER);
      INSERT INTO emp VALUES (1,'ceo',NULL),(2,'cto',1),(3,'dev',2),(4,'cfo',1),(5,'intern',3);`);
    const out = rows(
      db,
      `WITH RECURSIVE chain(id, name, depth) AS (
        SELECT id, name, 0 FROM emp WHERE boss IS NULL
        UNION ALL
        SELECT e.id, e.name, c.depth + 1 FROM emp e JOIN chain c ON e.boss = c.id
      ) SELECT name, depth FROM chain ORDER BY depth, id`,
    );
    assert.deepEqual(out, [
      ['ceo', 0],
      ['cto', 1],
      ['cfo', 1],
      ['dev', 2],
      ['intern', 3],
    ]);
  });

  test('UNION (not UNION ALL) in a recursive CTE de-duplicates, which terminates cycles', () => {
    const db = open();
    db.exec('CREATE TABLE edge(a, b); INSERT INTO edge VALUES (1,2),(2,3),(3,1)'); // a cycle
    const reach = rows(
      db,
      `WITH RECURSIVE r(n) AS (SELECT 1 UNION SELECT b FROM edge JOIN r ON a = n)
      SELECT n FROM r ORDER BY n`,
    ).flat();
    assert.deepEqual(reach, [1, 2, 3]);
  });

  test('a counter CTE replaces generate_series in library builds', () => {
    const db = open();
    assert.equal(
      scalar(
        db,
        'WITH RECURSIVE s(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM s WHERE x < 100) SELECT sum(x) FROM s',
      ),
      5050,
    );
  });

  test('MATERIALIZED forces the CTE to be computed once into a temp table', () => {
    const db = open();
    db.exec('CREATE TABLE t(x)');
    const planText = (
      db
        .prepare(
          'EXPLAIN QUERY PLAN WITH c AS MATERIALIZED (SELECT x FROM t) SELECT * FROM c, c AS d',
        )
        .all() as { detail: string }[]
    )
      .map((r) => r.detail)
      .join('\n');
    assert.match(planText, /MATERIALIZE c/);
  });
});

describe('window functions', () => {
  const setup = () => {
    const db = open();
    db.exec(`CREATE TABLE sale(day INTEGER, region TEXT, amount INTEGER);
      INSERT INTO sale VALUES (1,'eu',10),(2,'eu',20),(2,'us',5),(3,'eu',30),(4,'us',15);`);
    return db;
  };

  test('running total per partition and ranking', () => {
    const db = setup();
    assert.deepEqual(
      rows(
        db,
        `SELECT region, day, sum(amount) OVER (PARTITION BY region ORDER BY day) AS run
      FROM sale ORDER BY region, day`,
      ),
      [
        ['eu', 1, 10],
        ['eu', 2, 30],
        ['eu', 3, 60],
        ['us', 2, 5],
        ['us', 4, 20],
      ],
    );
    assert.deepEqual(
      rows(
        db,
        `SELECT day, rank() OVER w, dense_rank() OVER w, row_number() OVER w
      FROM sale WINDOW w AS (ORDER BY day) ORDER BY day, region`,
      ),
      [
        [1, 1, 1, 1],
        [2, 2, 2, 2],
        [2, 2, 2, 3],
        [3, 4, 3, 4],
        [4, 5, 4, 5],
      ],
    );
  });

  test('ROWS, RANGE and GROUPS frames differ on ties', () => {
    const db = setup();
    const frame = (f: string) =>
      rows(db, `SELECT sum(amount) OVER (ORDER BY day ${f}) FROM sale ORDER BY day, region`).flat();
    assert.deepEqual(frame('ROWS BETWEEN 1 PRECEDING AND CURRENT ROW'), [10, 30, 25, 35, 45]);
    assert.deepEqual(frame('RANGE BETWEEN 1 PRECEDING AND CURRENT ROW'), [10, 35, 35, 55, 45]);
    assert.deepEqual(frame('GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW'), [10, 35, 35, 55, 45]);
  });

  test('aggregate FILTER and frame EXCLUDE', () => {
    const db = setup();
    assert.equal(scalar(db, "SELECT sum(amount) FILTER (WHERE region = 'us') FROM sale"), 20);
    assert.deepEqual(
      rows(
        db,
        `SELECT sum(amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      EXCLUDE CURRENT ROW) FROM sale ORDER BY day, region`,
      ).flat(),
      [70, 60, 75, 50, 65],
    );
  });
});

describe('UPSERT and RETURNING', () => {
  test('ON CONFLICT DO UPDATE updates in place and RETURNING reports the final row', () => {
    const db = open();
    db.exec(
      "CREATE TABLE counter(k TEXT PRIMARY KEY, n INTEGER NOT NULL, note TEXT DEFAULT 'kept')",
    );
    const up = db.prepare(`INSERT INTO counter(k, n) VALUES (?, 1)
      ON CONFLICT(k) DO UPDATE SET n = n + excluded.n RETURNING k, n, note`);
    assert.deepEqual(up.raw().get('a'), ['a', 1, 'kept']);
    db.exec("UPDATE counter SET note = 'custom'");
    assert.deepEqual(
      up.raw().get('a'),
      ['a', 2, 'custom'],
      'unlike OR REPLACE, other columns survive',
    );
  });

  test('negative: INSERT OR REPLACE resets columns it does not mention', () => {
    const db = open();
    db.exec(
      "CREATE TABLE c(k TEXT PRIMARY KEY, n INTEGER, note TEXT DEFAULT 'kept'); INSERT INTO c VALUES ('a', 1, 'custom')",
    );
    db.exec("INSERT OR REPLACE INTO c(k, n) VALUES ('a', 2)");
    assert.equal(scalar(db, 'SELECT note FROM c'), 'kept');
  });

  test('multiple ON CONFLICT clauses are tried in order (3.35+)', () => {
    const db = open();
    db.exec(`CREATE TABLE u(id INTEGER PRIMARY KEY, email TEXT UNIQUE, hits INTEGER DEFAULT 0);
      INSERT INTO u VALUES (1, 'a@x', 0);`);
    db.exec(`INSERT INTO u(id, email) VALUES (2, 'a@x')
      ON CONFLICT(id) DO NOTHING
      ON CONFLICT(email) DO UPDATE SET hits = hits + 1`);
    assert.deepEqual(rows(db, 'SELECT id, hits FROM u'), [[1, 1]]);
  });

  test('negative: INSERT ... SELECT ... ON CONFLICT needs a WHERE to avoid a parsing ambiguity', () => {
    const db = open();
    db.exec('CREATE TABLE a(k PRIMARY KEY, v); CREATE TABLE b(k, v); INSERT INTO b VALUES (1, 1)');
    assert.throws(
      () => db.exec('INSERT INTO a SELECT k, v FROM b ON CONFLICT(k) DO NOTHING'),
      /syntax error/,
    );
    db.exec('INSERT INTO a SELECT k, v FROM b WHERE true ON CONFLICT(k) DO NOTHING');
    assert.equal(scalar(db, 'SELECT count(*) FROM a'), 1);
  });

  test('UPDATE ... FROM joins another table (3.33+)', () => {
    const db = open();
    db.exec(`CREATE TABLE stock(sku TEXT PRIMARY KEY, qty INTEGER); CREATE TABLE delta(sku TEXT, d INTEGER);
      INSERT INTO stock VALUES ('a', 10), ('b', 5); INSERT INTO delta VALUES ('a', -3), ('a', -2), ('b', 1);`);
    db.exec(`UPDATE stock SET qty = qty + t.d FROM (SELECT sku, sum(d) AS d FROM delta GROUP BY sku) AS t
      WHERE stock.sku = t.sku`);
    assert.deepEqual(rows(db, 'SELECT * FROM stock ORDER BY sku'), [
      ['a', 5],
      ['b', 6],
    ]);
  });
});

describe('JSON and JSONB', () => {
  test('-> returns JSON text, ->> returns an SQL value', () => {
    const db = open();
    const doc = '{"a":{"b":[1,2,{"c":"x"}]},"n":1.5}';
    assert.equal(scalar(db, "SELECT ? -> '$.a.b[2]'", doc), '{"c":"x"}');
    assert.equal(scalar(db, "SELECT ? ->> '$.a.b[2].c'", doc), 'x');
    assert.equal(scalar(db, "SELECT ? -> '$.a.b[2].c'", doc), '"x"');
    assert.equal(scalar(db, "SELECT ? ->> '$.a.b[#-1].c'", doc), 'x', '#-1 indexes from the end');
    assert.equal(scalar(db, "SELECT typeof(? ->> 'n')", doc), 'real');
  });

  test('JSONB is a binary BLOB that every json function accepts', () => {
    const db = open();
    const text = '{"tags":["a","b","c"],"n":42}';
    assert.equal(scalar(db, 'SELECT typeof(jsonb(?))', text), 'blob');
    assert.equal(scalar(db, 'SELECT json(jsonb(?))', text), text);
    assert.equal(scalar(db, "SELECT jsonb(?) ->> '$.n'", text), 42);
    assert.ok(scalar<number>(db, 'SELECT length(jsonb(?))', text) < text.length);
  });

  test('json_each, json_group_array and json_array_insert (3.53)', () => {
    const db = open();
    assert.deepEqual(rows(db, "SELECT key, value FROM json_each('[10,20]')"), [
      [0, 10],
      [1, 20],
    ]);
    assert.equal(
      scalar(db, 'SELECT json_group_array(x) FROM (SELECT 1 x UNION ALL SELECT 2)'),
      '[1,2]',
    );
    assert.equal(scalar(db, "SELECT json_array_insert('[1,3]', '$[1]', 2)"), '[1,2,3]');
  });

  test('negative: malformed JSON raises an error; json_valid reports instead', () => {
    const db = open();
    assert.throws(() => db.prepare("SELECT json('{bad')").get(), /malformed JSON/);
    assert.equal(scalar(db, "SELECT json_valid('{bad')"), 0);
  });

  test('index a JSON field with an expression index', () => {
    const db = open();
    db.exec("CREATE TABLE ev(doc TEXT); CREATE INDEX ev_kind ON ev(doc ->> '$.kind')");
    const p = (
      db.prepare("EXPLAIN QUERY PLAN SELECT * FROM ev WHERE doc ->> '$.kind' = 'click'").all() as {
        detail: string;
      }[]
    )[0]?.detail;
    assert.match(p ?? '', /USING INDEX ev_kind/);
  });
});

describe('date and time', () => {
  test('timestamps are UTC unless you ask for localtime; unixepoch and subsec', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT datetime(0, 'unixepoch')"), '1970-01-01 00:00:00');
    assert.equal(scalar(db, "SELECT unixepoch('2026-10-09 12:00:00')"), 1791547200);
    assert.equal(scalar(db, "SELECT typeof(unixepoch('now','subsec'))"), 'real');
    assert.equal(
      scalar(db, "SELECT date('2026-01-31', '+1 month')"),
      '2026-03-03',
      'ceiling is the default',
    );
    assert.equal(scalar(db, "SELECT date('2026-01-31', '+1 month', 'floor')"), '2026-02-28');
  });

  test('negative: an unknown modifier yields NULL, not an error', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT date('2026-01-01', '+1 fortnight')"), null);
  });

  test('3.54 modifiers: end of month/year/day and weekday -N (node:sqlite bundles 3.54.0)', () => {
    const db = new DatabaseSync(':memory:');
    const v = (db.prepare('SELECT sqlite_version() AS v').get() as { v: string }).v;
    assert.equal(v, BUNDLED.nodeSqlite);
    const q = (sql: string) => (db.prepare(`SELECT ${sql} AS r`).get() as { r: unknown }).r;
    assert.equal(q("date('2026-02-10', 'end of month')"), '2026-02-28');
    assert.equal(
      q("datetime('2026-02-10 08:00', 'end of day', 'subsec')"),
      '2026-02-10 23:59:59.999',
    );
    assert.equal(
      q("date('2026-01-01', 'end of year', 'weekday -5')"),
      '2026-12-25',
      'last Friday of 2026',
    );
    assert.equal(q("date('2026-11-04', 'weekday -1')"), '2026-11-02', 'previous Monday');
    db.close();
  });

  test('printf %j renders a JSON string body, %J a full JSON string literal (3.54)', () => {
    const db = new DatabaseSync(':memory:');
    const r = db
      .prepare(`SELECT format('%j', 'say "hi"') AS j, format('%J', 'say "hi"') AS jj`)
      .get() as { j: string; jj: string };
    assert.equal(r.j, 'say \\"hi\\"');
    assert.equal(r.jj, '"say \\"hi\\""');
    db.close();
  });
});

describe('ALTER TABLE', () => {
  test('RENAME COLUMN rewrites references in indexes, triggers and views', () => {
    const db = open();
    db.exec(`CREATE TABLE t(a, b); CREATE INDEX t_a ON t(a); CREATE VIEW v AS SELECT a FROM t;
      ALTER TABLE t RENAME COLUMN a TO alpha;`);
    assert.match(scalar<string>(db, "SELECT sql FROM sqlite_schema WHERE name = 'v'"), /alpha/);
    assert.match(scalar<string>(db, "SELECT sql FROM sqlite_schema WHERE name = 't_a'"), /alpha/);
  });

  test('negative: DROP COLUMN refuses indexed or constrained columns', () => {
    const db = open();
    db.exec('CREATE TABLE t(a, b UNIQUE, c); CREATE INDEX t_a ON t(a)');
    assert.throws(
      () => db.exec('ALTER TABLE t DROP COLUMN a'),
      /error in index t_a after drop column/,
    );
    assert.throws(() => db.exec('ALTER TABLE t DROP COLUMN b'), /UNIQUE/);
    db.exec('ALTER TABLE t DROP COLUMN c');
    assert.equal(scalar(db, "SELECT count(*) FROM pragma_table_info('t')"), 2);
  });

  test('SET NOT NULL / DROP NOT NULL (3.53+) validate existing rows', () => {
    const db = open();
    db.exec('CREATE TABLE t(a); INSERT INTO t VALUES (1), (NULL)');
    assert.throws(() => db.exec('ALTER TABLE t ALTER COLUMN a SET NOT NULL'));
    db.exec('DELETE FROM t WHERE a IS NULL; ALTER TABLE t ALTER COLUMN a SET NOT NULL');
    assert.equal(
      errorCode(() => db.exec('INSERT INTO t VALUES (NULL)')),
      'SQLITE_CONSTRAINT_NOTNULL',
    );
    db.exec('ALTER TABLE t ALTER COLUMN a DROP NOT NULL; INSERT INTO t VALUES (NULL)');
  });

  test('the 12-step rebuild changes a column type and keeps referencing children intact', () => {
    const db = open();
    db.exec(`CREATE TABLE parent(id INTEGER PRIMARY KEY, code);
      CREATE TABLE child(pid INTEGER REFERENCES parent(id) ON DELETE CASCADE);
      CREATE INDEX parent_code ON parent(code);
      INSERT INTO parent VALUES (1, '7'), (2, '8'); INSERT INTO child VALUES (1), (2);`);
    // Steps 1-12 (see the module). foreign_keys must be OFF, and it cannot be changed inside a transaction.
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      const saved = db
        .prepare(
          "SELECT sql FROM sqlite_schema WHERE tbl_name = 'parent' AND type IN ('index','trigger','view') AND sql IS NOT NULL",
        )
        .pluck()
        .all() as string[];
      db.exec('CREATE TABLE parent_new(id INTEGER PRIMARY KEY, code INTEGER NOT NULL) STRICT');
      db.exec('INSERT INTO parent_new(id, code) SELECT id, CAST(code AS INTEGER) FROM parent');
      db.exec('DROP TABLE parent');
      db.exec('ALTER TABLE parent_new RENAME TO parent');
      for (const sql of saved) db.exec(sql);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    })();
    db.pragma('foreign_keys = ON');
    assert.equal(
      scalar(db, 'SELECT count(*) FROM child'),
      2,
      'children survived DROP TABLE parent',
    );
    assert.equal(scalar(db, 'SELECT typeof(code) FROM parent WHERE id = 1'), 'integer');
    db.exec('DELETE FROM parent WHERE id = 1');
    assert.equal(scalar(db, 'SELECT count(*) FROM child'), 1, 'FK now points at the new table');
  });

  test('negative: with foreign_keys=ON, DROP TABLE parent runs an implicit DELETE that cascades', () => {
    const db = open();
    db.exec(`CREATE TABLE parent(id INTEGER PRIMARY KEY);
      CREATE TABLE child(pid INTEGER REFERENCES parent(id) ON DELETE CASCADE);
      INSERT INTO parent VALUES (1); INSERT INTO child VALUES (1);`);
    db.exec('DROP TABLE parent');
    assert.equal(scalar(db, 'SELECT count(*) FROM child'), 0, 'children were deleted');
  });
});

describe('SQLite-specific query semantics', () => {
  test('bare columns with a single min() or max() come from the extreme row', () => {
    const db = open();
    db.exec("CREATE TABLE s(name, score); INSERT INTO s VALUES ('a', 3), ('b', 9), ('c', 5)");
    assert.deepEqual(rows(db, 'SELECT name, max(score) FROM s'), [['b', 9]]);
  });

  test('IS, IS NOT DISTINCT FROM, and NULL in DISTINCT/GROUP BY', () => {
    const db = open();
    assert.equal(scalar(db, 'SELECT NULL = NULL'), null);
    assert.equal(scalar(db, 'SELECT NULL IS NULL'), 1);
    assert.equal(scalar(db, 'SELECT 1 IS NOT DISTINCT FROM 1'), 1);
    assert.equal(
      scalar(
        db,
        'SELECT count(*) FROM (SELECT DISTINCT x FROM (SELECT NULL x UNION ALL SELECT NULL))',
      ),
      1,
    );
  });

  test('RIGHT and FULL OUTER JOIN (3.39+)', () => {
    const db = open();
    db.exec(
      'CREATE TABLE l(k); CREATE TABLE r(k); INSERT INTO l VALUES (1),(2); INSERT INTO r VALUES (2),(3)',
    );
    assert.deepEqual(
      rows(db, 'SELECT l.k, r.k FROM l FULL JOIN r ON l.k = r.k ORDER BY coalesce(l.k, r.k)'),
      [
        [1, null],
        [2, 2],
        [null, 3],
      ],
    );
  });

  test('LIKE is ASCII case-insensitive, GLOB is case-sensitive', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT 'Hello' LIKE 'hello'"), 1);
    assert.equal(scalar(db, "SELECT 'Ärger' LIKE 'ärger'"), 0);
    assert.equal(scalar(db, "SELECT 'Hello' GLOB 'h*'"), 0);
    assert.equal(scalar(db, "SELECT 'Hello' GLOB 'H*'"), 1);
  });

  test('two-argument iif() (3.48+) and triggers with RAISE', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT iif(0, 'yes')"), null);
    db.exec(`CREATE TABLE acct(id INTEGER PRIMARY KEY, bal INTEGER);
      CREATE TRIGGER no_overdraft BEFORE UPDATE OF bal ON acct WHEN NEW.bal < 0
      BEGIN SELECT RAISE(ABORT, 'overdraft'); END;
      INSERT INTO acct VALUES (1, 10);`);
    assert.throws(() => db.exec('UPDATE acct SET bal = -1'), /overdraft/);
  });
});

describe('strings, Unicode and aggregates (§ 8.6 and § 8.7)', () => {
  test('length counts characters, octet_length counts bytes', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT length('žluťoučký')"), 9);
    assert.equal(scalar(db, "SELECT octet_length('žluťoučký')"), 13);
    assert.equal(scalar(db, "SELECT substr('abcdef', -2)"), 'ef');
  });

  test('negative: || propagates NULL; concat and concat_ws skip it', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT 'a' || NULL"), null);
    assert.equal(scalar(db, "SELECT concat('a', NULL, 'b')"), 'ab');
    assert.equal(scalar(db, "SELECT concat_ws(' ', 'Ada', NULL, 'Lovelace')"), 'Ada Lovelace');
  });

  test('upper() is ASCII-only; char() and unistr() build code points', () => {
    const db = open();
    assert.equal(scalar(db, "SELECT upper('é')"), 'é');
    assert.equal(scalar(db, 'SELECT char(382)'), 'ž');
    assert.equal(scalar(db, "SELECT unistr('\\u017E')"), 'ž');
    assert.equal(scalar(db, "SELECT unicode('ž')"), 382);
  });

  test('total() versus sum() on an empty set; median and string_agg', () => {
    const db = open();
    db.exec('CREATE TABLE e(x)');
    assert.equal(scalar(db, 'SELECT sum(x) FROM e'), null);
    assert.equal(scalar(db, 'SELECT total(x) FROM e'), 0);
    assert.equal(
      scalar(db, 'SELECT median(x) FROM (SELECT 1 x UNION ALL SELECT 5 UNION ALL SELECT 9)'),
      5,
    );
    assert.equal(
      scalar(
        db,
        "SELECT string_agg(x, ',' ORDER BY x DESC) FROM (SELECT 'a' x UNION ALL SELECT 'b')",
      ),
      'b,a',
    );
    assert.equal(scalar(db, 'SELECT sqrt(16)'), 4);
  });
});
