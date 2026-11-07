// Module 07: VDBE bytecode, EXPLAIN QUERY PLAN, index selection, ANALYZE, LIKE optimisation.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { open, scalar, plan, type Db } from './helpers.ts';

function orders(): Db {
  const db = open();
  db.exec(`CREATE TABLE orders(
      id INTEGER PRIMARY KEY, customer INTEGER NOT NULL, status TEXT NOT NULL,
      total INTEGER NOT NULL, email TEXT, created TEXT NOT NULL);`);
  const ins = db.prepare(
    'INSERT INTO orders(customer, status, total, email, created) VALUES (?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (let i = 0; i < 5000; i++) {
      ins.run(
        i % 500,
        i % 50 === 0 ? 'open' : 'done',
        (i * 37) % 1000,
        `user${i}@example.com`,
        `2026-${String(1 + (i % 12)).padStart(2, '0')}-01`,
      );
    }
  })();
  return db;
}

describe('VDBE bytecode with EXPLAIN', () => {
  test('a full scan compiles to Init, OpenRead, Rewind, Column, ResultRow, Next, Halt', () => {
    const db = open();
    db.exec('CREATE TABLE t(a, b)');
    const ops = (db.prepare('EXPLAIN SELECT a FROM t').all() as { opcode: string }[]).map(
      (r) => r.opcode,
    );
    for (const op of [
      'Init',
      'OpenRead',
      'Rewind',
      'Column',
      'ResultRow',
      'Next',
      'Halt',
      'Transaction',
    ]) {
      assert.ok(ops.includes(op), `missing ${op} in ${ops.join(',')}`);
    }
    assert.equal(
      ops[0],
      'Init',
      'program starts with Init, which jumps to the Transaction/lock setup at the end',
    );
  });

  test('a rowid lookup uses SeekRowid instead of a loop', () => {
    const db = open();
    db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, a)');
    const ops = (
      db.prepare('EXPLAIN SELECT a FROM t WHERE id = ?').all(1) as { opcode: string }[]
    ).map((r) => r.opcode);
    assert.ok(ops.includes('SeekRowid'));
    assert.ok(!ops.includes('Rewind'));
  });

  test('an index search opens two cursors (index, then table) unless the index covers the query', () => {
    const db = open();
    db.exec('CREATE TABLE t(a, b, c); CREATE INDEX t_a ON t(a)');
    const opens = (sql: string) =>
      (db.prepare(`EXPLAIN ${sql}`).all() as { opcode: string }[]).filter(
        (r) => r.opcode === 'OpenRead',
      ).length;
    assert.equal(opens('SELECT c FROM t WHERE a = 1'), 2);
    assert.equal(opens('SELECT a FROM t WHERE a = 1'), 1, 'covering: the table is never opened');
  });
});

describe('EXPLAIN QUERY PLAN and index selection', () => {
  test('SCAN without an index; SEARCH with one; rowid lookups need no index', () => {
    const db = orders();
    assert.match(plan(db, 'SELECT * FROM orders WHERE customer = 7'), /^SCAN orders$/);
    assert.match(
      plan(db, 'SELECT * FROM orders WHERE id = 7'),
      /SEARCH orders USING INTEGER PRIMARY KEY \(rowid=\?\)/,
    );
    db.exec('CREATE INDEX orders_customer ON orders(customer)');
    assert.match(
      plan(db, 'SELECT * FROM orders WHERE customer = 7'),
      /SEARCH orders USING INDEX orders_customer \(customer=\?\)/,
    );
  });

  test('composite index: leftmost prefix, then one range; COVERING when no table access is needed', () => {
    const db = orders();
    db.exec('CREATE INDEX orders_cust_created ON orders(customer, created)');
    assert.match(
      plan(db, "SELECT * FROM orders WHERE customer = 7 AND created > '2026-06'"),
      /USING INDEX orders_cust_created \(customer=\? AND created>\?\)/,
    );
    assert.match(
      plan(db, 'SELECT created FROM orders WHERE customer = 7'),
      /USING COVERING INDEX orders_cust_created/,
    );
    assert.match(
      plan(db, "SELECT * FROM orders WHERE created > '2026-06'"),
      /^SCAN orders/,
      'second column alone: no seek',
    );
  });

  test('ORDER BY satisfied by an index avoids a temp B-tree sort', () => {
    const db = orders();
    assert.match(plan(db, 'SELECT * FROM orders ORDER BY total'), /USE TEMP B-TREE FOR ORDER BY/);
    db.exec('CREATE INDEX orders_total ON orders(total)');
    assert.doesNotMatch(plan(db, 'SELECT * FROM orders ORDER BY total'), /TEMP B-TREE/);
  });

  test('negative: a function on the column defeats the index; an expression index restores it', () => {
    const db = orders();
    db.exec('CREATE INDEX orders_email ON orders(email)');
    assert.match(
      plan(db, "SELECT id FROM orders WHERE lower(email) = 'user7@example.com'"),
      /^SCAN/,
    );
    db.exec('CREATE INDEX orders_email_lower ON orders(lower(email))');
    assert.match(
      plan(db, "SELECT id FROM orders WHERE lower(email) = 'user7@example.com'"),
      /USING (COVERING )?INDEX orders_email_lower/,
    );
  });

  test('a partial index is used only when the WHERE clause implies its predicate', () => {
    const db = orders();
    db.exec("CREATE INDEX orders_open ON orders(created) WHERE status = 'open'");
    assert.match(
      plan(db, "SELECT id FROM orders WHERE status = 'open' AND created > '2026-03'"),
      /USING (COVERING )?INDEX orders_open/,
    );
    assert.doesNotMatch(plan(db, "SELECT id FROM orders WHERE created > '2026-03'"), /orders_open/);
    assert.ok(
      scalar<number>(db, "SELECT count(*) FROM dbstat WHERE name = 'orders_open'") <= 2,
      'tiny: 100 of 5000 rows',
    );
  });

  test('OR across different columns can use several indexes (MULTI-INDEX OR)', () => {
    const db = orders();
    db.exec(
      'CREATE INDEX orders_customer ON orders(customer); CREATE INDEX orders_total ON orders(total)',
    );
    assert.match(
      plan(db, 'SELECT * FROM orders WHERE customer = 3 OR total = 999'),
      /MULTI-INDEX OR/,
    );
  });

  test('the unary + operator and NOT INDEXED disable an index; INDEXED BY forces one', () => {
    const db = orders();
    db.exec('CREATE INDEX orders_customer ON orders(customer)');
    assert.match(plan(db, 'SELECT * FROM orders WHERE +customer = 3'), /^SCAN/);
    assert.match(plan(db, 'SELECT * FROM orders NOT INDEXED WHERE customer = 3'), /^SCAN/);
    assert.match(
      plan(db, 'SELECT * FROM orders INDEXED BY orders_customer WHERE customer > 3'),
      /USING INDEX orders_customer/,
    );
    assert.throws(
      () => db.prepare('SELECT * FROM orders INDEXED BY no_such_index').all(),
      /no such index/,
    );
  });

  test('an automatic index is built at run time for a join on an unindexed column', () => {
    const db = orders();
    db.exec(
      'CREATE TABLE customers(cid INTEGER, name TEXT); INSERT INTO customers SELECT value, NULL FROM json_each(json_array(1,2,3))',
    );
    assert.match(
      plan(db, 'SELECT * FROM customers c JOIN orders o ON o.total = c.cid'),
      /AUTOMATIC (COVERING|PARTIAL COVERING)?\s*INDEX/,
    );
    db.pragma('automatic_index = OFF');
    assert.doesNotMatch(
      plan(db, 'SELECT * FROM customers c JOIN orders o ON o.total = c.cid'),
      /AUTOMATIC/,
    );
  });

  test('CROSS JOIN fixes the join order', () => {
    const db = orders();
    db.exec('CREATE TABLE tiny(k INTEGER PRIMARY KEY); INSERT INTO tiny VALUES (1)');
    const order = (sql: string) =>
      plan(db, sql)
        .split('\n')
        .map((l) => l.split(' ')[1]);
    assert.deepEqual(order('SELECT * FROM orders o CROSS JOIN tiny t WHERE t.k = o.customer'), [
      'o',
      't',
    ]);
  });
});

describe('statistics: ANALYZE, sqlite_stat1, skip-scan, PRAGMA optimize', () => {
  test('ANALYZE writes sqlite_stat1 rows: row count, then average rows per distinct prefix', () => {
    const db = orders();
    db.exec('CREATE INDEX orders_status_customer ON orders(status, customer); ANALYZE');
    const stat = scalar<string>(
      db,
      "SELECT stat FROM sqlite_stat1 WHERE idx = 'orders_status_customer'",
    );
    const [rows, perStatus, perPair] = stat.split(' ').map(Number);
    assert.equal(rows, 5000);
    assert.equal(perStatus, 2500, '5000 rows / 2 statuses');
    assert.ok(perPair! <= 10);
    assert.ok(
      scalar<number>(db, 'SELECT count(*) FROM sqlite_stat4') > 0,
      'STAT4 samples (ENABLE_STAT4 build)',
    );
  });

  test('with statistics showing a low-cardinality first column, the planner uses a skip-scan', () => {
    const db = orders();
    db.exec('CREATE INDEX orders_status_customer ON orders(status, customer)');
    assert.match(plan(db, 'SELECT id FROM orders WHERE customer = 7'), /^SCAN/);
    db.exec('ANALYZE');
    assert.match(
      plan(db, 'SELECT id FROM orders WHERE customer = 7'),
      /ANY\(status\) AND customer=\?/,
    );
  });

  test('PRAGMA optimize runs ANALYZE only where it looks useful, and can be limited', () => {
    const db = orders();
    db.exec('CREATE INDEX orders_customer ON orders(customer)');
    assert.equal(scalar(db, "SELECT count(*) FROM sqlite_schema WHERE name = 'sqlite_stat1'"), 0);
    db.exec('SELECT * FROM orders WHERE customer = 1'); // optimize looks at what the connection has used
    db.pragma('analysis_limit = 400');
    db.pragma('optimize = 0x10002'); // 0x10000: check all tables, as recommended at connection open
    assert.ok(scalar<number>(db, "SELECT count(*) FROM sqlite_stat1 WHERE tbl = 'orders'") >= 1);
  });

  test('negative: hand-written stale statistics can make the planner choose a bad index', () => {
    const db = orders();
    db.exec(`CREATE INDEX orders_status ON orders(status); CREATE INDEX orders_customer ON orders(customer); ANALYZE;
      UPDATE sqlite_stat1 SET stat = '5000 1' WHERE idx = 'orders_status';
      UPDATE sqlite_stat1 SET stat = '5000 2500' WHERE idx = 'orders_customer';
      DELETE FROM sqlite_stat4; -- STAT4 samples would otherwise override the stat1 averages
      ANALYZE sqlite_schema;`); // reload the statistics into the planner
    assert.match(
      plan(db, "SELECT * FROM orders WHERE status = 'done' AND customer = 7"),
      /orders_status/,
    );
  });
});

describe('the LIKE and GLOB optimisation', () => {
  const setup = () => {
    const db = open();
    db.exec(`CREATE TABLE p(name TEXT); CREATE INDEX p_bin ON p(name);
      CREATE TABLE q(name TEXT COLLATE NOCASE); CREATE INDEX q_nocase ON q(name);`);
    return db;
  };

  test('case-insensitive LIKE needs a NOCASE index; a BINARY index only serves GLOB', () => {
    const db = setup();
    assert.match(plan(db, "SELECT * FROM p WHERE name LIKE 'abc%'"), /^SCAN p/);
    assert.match(
      plan(db, "SELECT * FROM q WHERE name LIKE 'abc%'"),
      /SEARCH q USING COVERING INDEX q_nocase \(name>\? AND name<\?\)/,
    );
    assert.match(
      plan(db, "SELECT * FROM p WHERE name GLOB 'abc*'"),
      /SEARCH p USING COVERING INDEX p_bin \(name>\? AND name<\?\)/,
    );
  });

  test('negative: a leading wildcard, or a bound parameter, cannot use the range rewrite reliably', () => {
    const db = setup();
    assert.match(plan(db, "SELECT * FROM q WHERE name LIKE '%abc'"), /SCAN q/);
  });

  test('case_sensitive_like makes LIKE use the BINARY index (deprecated pragma)', () => {
    const db = setup();
    db.pragma('case_sensitive_like = ON');
    assert.match(plan(db, "SELECT * FROM p WHERE name LIKE 'abc%'"), /USING COVERING INDEX p_bin/);
    assert.equal(scalar(db, "SELECT 'ABC' LIKE 'abc'"), 0);
  });
});
