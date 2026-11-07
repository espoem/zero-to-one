// Module 08: FTS5, R*Tree, virtual tables and application-defined functions.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { open, scalar, plan, errorCode, type Db } from './helpers.ts';
import { referenceBm25, fts5Structure, segmentCount, rowLengths } from './fts5-internals.ts';

const col = (db: Db, sql: string, ...p: unknown[]) =>
  db
    .prepare(sql)
    .pluck()
    .all(...p);

function library(tokenize = 'unicode61 remove_diacritics 2'): Db {
  const db = open();
  db.exec(`CREATE VIRTUAL TABLE doc USING fts5(title, body, tokenize = '${tokenize}')`);
  const ins = db.prepare('INSERT INTO doc(rowid, title, body) VALUES (?, ?, ?)');
  ins.run(1, 'SQLite WAL mode', 'Readers do not block writers in write-ahead logging mode.');
  ins.run(
    2,
    'Rollback journal',
    'The rollback journal blocks readers during commit. Journal journal journal.',
  );
  ins.run(3, 'Příliš žluťoučký kůň', 'Czech pangram with diacritics.');
  ins.run(4, 'Checkpoints', 'A checkpoint copies WAL frames back into the database file.');
  return db;
}

describe('FTS5 queries', () => {
  test('MATCH with terms, phrases, prefixes, column filters, NEAR and boolean operators', () => {
    const db = library();
    const q = (m: string) => col(db, 'SELECT rowid FROM doc WHERE doc MATCH ? ORDER BY rowid', m);
    assert.deepEqual(q('wal'), [1, 4]);
    assert.deepEqual(
      q('"write ahead logging"'),
      [1],
      'phrase: hyphen is a separator for unicode61',
    );
    assert.deepEqual(q('check*'), [4], 'prefix query');
    assert.deepEqual(q('title:journal'), [2], 'column filter');
    assert.deepEqual(q('readers NOT wal'), [2], 'NOT is a binary operator in FTS5');
    assert.deepEqual(q('wal OR journal'), [1, 2, 4]);
    assert.deepEqual(q('NEAR(checkpoint frames, 3)'), [4]);
  });

  test('remove_diacritics folds Czech accents; case is folded too', () => {
    const db = library();
    assert.deepEqual(col(db, "SELECT rowid FROM doc WHERE doc MATCH 'prilis zlutoucky KUN'"), [3]);
  });

  test('bm25() ranks: smaller (more negative) is better; column weights change the order', () => {
    const db = library();
    const ranked = col(
      db,
      "SELECT rowid FROM doc WHERE doc MATCH 'journal OR wal' ORDER BY bm25(doc)",
    );
    assert.equal(ranked[0], 2, 'four occurrences of journal win');
    assert.ok(scalar<number>(db, "SELECT bm25(doc) FROM doc WHERE doc MATCH 'journal'") < 0);
    // Weight titles 10x: a title hit on "wal" now beats the body-heavy journal document.
    const weighted = col(
      db,
      "SELECT rowid FROM doc WHERE doc MATCH 'journal OR wal' ORDER BY bm25(doc, 10.0, 1.0)",
    );
    assert.notDeepEqual(weighted, ranked);
    // The hidden `rank` column is bm25 by default and lets FTS5 sort efficiently.
    assert.deepEqual(
      col(db, "SELECT rowid FROM doc WHERE doc MATCH 'journal OR wal' ORDER BY rank"),
      ranked,
    );
  });

  test('highlight() and snippet() mark matches', () => {
    const db = library();
    assert.equal(
      scalar(db, "SELECT highlight(doc, 0, '[', ']') FROM doc WHERE doc MATCH 'wal' AND rowid = 1"),
      'SQLite [WAL] mode',
    );
    assert.match(
      scalar<string>(
        db,
        "SELECT snippet(doc, 1, '<b>', '</b>', '…', 4) FROM doc WHERE doc MATCH 'frames'",
      ),
      /<b>frames<\/b>/,
    );
  });

  test('negative: FTS5 query syntax errors are SQL errors; quote user input as a phrase', () => {
    const db = library();
    assert.throws(
      () => db.prepare("SELECT * FROM doc WHERE doc MATCH 'wal AND'").all(),
      /fts5: syntax error/,
    );
    const userInput = 'wal AND';
    const safe = '"' + userInput.replaceAll('"', '""') + '"';
    assert.deepEqual(col(db, 'SELECT rowid FROM doc WHERE doc MATCH ?', safe), []);
  });

  test('the porter tokenizer stems English words', () => {
    const plain = library('unicode61');
    const stem = library('porter unicode61');
    assert.deepEqual(col(plain, "SELECT rowid FROM doc WHERE doc MATCH 'writer'"), []);
    assert.deepEqual(
      col(stem, "SELECT rowid FROM doc WHERE doc MATCH 'writer'"),
      [1],
      'writer matches writers',
    );
  });

  test('the trigram tokenizer serves LIKE and GLOB substring queries from the index', () => {
    const db = open();
    db.exec("CREATE VIRTUAL TABLE t USING fts5(s, tokenize = 'trigram')");
    db.exec("INSERT INTO t VALUES ('postgres'), ('sqlite'), ('litestream')");
    assert.deepEqual(col(db, "SELECT s FROM t WHERE s LIKE '%lite%' ORDER BY s"), [
      'litestream',
      'sqlite',
    ]);
    assert.match(plan(db, "SELECT s FROM t WHERE s LIKE '%lite%'"), /VIRTUAL TABLE INDEX/);
  });
});

describe('FTS5 external-content tables', () => {
  test('triggers keep the index in sync with a normal table; the index stores no copy of the text', () => {
    const db = open();
    db.exec(`
      CREATE TABLE note(id INTEGER PRIMARY KEY, body TEXT NOT NULL);
      CREATE VIRTUAL TABLE note_fts USING fts5(body, content = 'note', content_rowid = 'id');
      CREATE TRIGGER note_ai AFTER INSERT ON note BEGIN
        INSERT INTO note_fts(rowid, body) VALUES (new.id, new.body); END;
      CREATE TRIGGER note_ad AFTER DELETE ON note BEGIN
        INSERT INTO note_fts(note_fts, rowid, body) VALUES ('delete', old.id, old.body); END;
      CREATE TRIGGER note_au AFTER UPDATE ON note BEGIN
        INSERT INTO note_fts(note_fts, rowid, body) VALUES ('delete', old.id, old.body);
        INSERT INTO note_fts(rowid, body) VALUES (new.id, new.body); END;
      INSERT INTO note(body) VALUES ('buy milk'), ('fix the wal checkpoint');
      UPDATE note SET body = 'buy oat milk' WHERE id = 1;
      DELETE FROM note WHERE id = 2;`);
    assert.deepEqual(col(db, "SELECT rowid FROM note_fts WHERE note_fts MATCH 'oat'"), [1]);
    assert.deepEqual(col(db, "SELECT rowid FROM note_fts WHERE note_fts MATCH 'checkpoint'"), []);
    assert.equal(
      scalar(db, "SELECT count(*) FROM sqlite_schema WHERE name = 'note_fts_content'"),
      0,
      'no shadow content table',
    );
  });

  test('negative: without the delete trigger the index returns ghost rows; rebuild repairs it', () => {
    const db = open();
    db.exec(`CREATE TABLE note(id INTEGER PRIMARY KEY, body TEXT);
      CREATE VIRTUAL TABLE note_fts USING fts5(body, content = 'note', content_rowid = 'id');
      INSERT INTO note VALUES (1, 'ghost row'); INSERT INTO note_fts(rowid, body) VALUES (1, 'ghost row');
      DELETE FROM note WHERE id = 1;`);
    assert.deepEqual(
      col(db, "SELECT rowid FROM note_fts WHERE note_fts MATCH 'ghost'"),
      [1],
      'stale match',
    );
    db.exec("INSERT INTO note_fts(note_fts) VALUES ('rebuild')");
    assert.deepEqual(col(db, "SELECT rowid FROM note_fts WHERE note_fts MATCH 'ghost'"), []);
  });

  test('fts5vocab exposes the inverted index: terms, documents and occurrences', () => {
    const db = library();
    db.exec("CREATE VIRTUAL TABLE v USING fts5vocab(doc, 'row')");
    const row = db.prepare("SELECT doc, cnt FROM v WHERE term = 'journal'").raw().get();
    assert.deepEqual(row, [1, 5], 'one document, five occurrences (title + body)');
  });
});

describe('R*Tree spatial index', () => {
  test('bounding-box overlap queries use the R*Tree, and coordinates are 32-bit floats', () => {
    const db = open();
    db.exec(`CREATE VIRTUAL TABLE place USING rtree(id, min_x, max_x, min_y, max_y);
      INSERT INTO place VALUES (1, 16.5, 16.7, 49.1, 49.3), (2, 18.1, 18.2, 49.5, 49.6), (3, 14.3, 14.6, 50.0, 50.2);`);
    // Which boxes overlap the window x in [16, 19], y in [49, 50]?
    const hits = col(
      db,
      `SELECT id FROM place WHERE max_x >= 16 AND min_x <= 19 AND max_y >= 49 AND min_y <= 50 ORDER BY id`,
    );
    assert.deepEqual(hits, [1, 2]);
    assert.match(
      plan(db, 'SELECT id FROM place WHERE max_x >= 16 AND min_x <= 19'),
      /VIRTUAL TABLE INDEX/,
    );
    db.exec('INSERT INTO place VALUES (4, 0.1, 0.1, 0, 0)');
    assert.notEqual(
      scalar(db, 'SELECT min_x FROM place WHERE id = 4'),
      0.1,
      'stored as float32: rounded',
    );
  });
});

describe('application-defined functions, aggregates and table-valued functions', () => {
  test('a deterministic JS function can back an expression index; a non-deterministic one cannot', () => {
    const db = open();
    db.function('slug', { deterministic: true }, (s: unknown) =>
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    );
    db.function('noise', () => Math.random());
    db.exec(
      "CREATE TABLE post(title TEXT); CREATE INDEX post_slug ON post(slug(title)); INSERT INTO post VALUES ('Hello, World')",
    );
    assert.equal(
      scalar(db, "SELECT title FROM post WHERE slug(title) = 'hello-world'"),
      'Hello, World',
    );
    assert.match(
      plan(db, "SELECT title FROM post WHERE slug(title) = 'hello-world'"),
      /USING INDEX post_slug/,
    );
    assert.throws(() => db.exec('CREATE INDEX post_noise ON post(noise())'), /non-deterministic/);
  });

  test('an aggregate with an inverse step works as a sliding window function', () => {
    const db = open();
    db.aggregate('sumsq', {
      start: 0,
      step: (acc: number, x: number) => acc + x * x,
      inverse: (acc: number, x: number) => acc - x * x,
    });
    db.exec('CREATE TABLE s(x); INSERT INTO s VALUES (1), (2), (3), (4)');
    assert.equal(scalar(db, 'SELECT sumsq(x) FROM s'), 30);
    assert.deepEqual(
      col(db, 'SELECT sumsq(x) OVER (ORDER BY x ROWS 1 PRECEDING) FROM s'),
      [1, 5, 13, 25],
    );
  });

  test('a table-valued function implemented in JavaScript (generate_series for library builds)', () => {
    const db = open();
    db.table('series', {
      columns: ['value'],
      parameters: ['start', 'stop'],
      *rows(start: unknown, stop: unknown) {
        for (let i = Number(start); i <= Number(stop); i++) yield { value: i };
      },
    });
    assert.equal(scalar(db, 'SELECT sum(value) FROM series(1, 100)'), 5050);
  });

  test('negative: node:sqlite refuses to load extensions unless allowExtension was set at open', () => {
    const db = new DatabaseSync(':memory:');
    assert.throws(
      () => db.loadExtension('./does-not-matter'),
      /extension loading is not allowed|not allowed/i,
    );
    db.close();
  });
});

describe('FTS5 internals: BM25, segments, prefix and detail options', () => {
  function corpus(): Db {
    const db = open();
    db.exec('CREATE VIRTUAL TABLE doc USING fts5(title, body)');
    const ins = db.prepare('INSERT INTO doc(rowid, title, body) VALUES (?, ?, ?)');
    ins.run(1, 'alpha', 'common common rare filler filler filler');
    ins.run(2, 'common alpha', 'common filler');
    ins.run(3, 'beta', 'common rare rare rare filler filler filler filler filler filler');
    ins.run(4, 'gamma', 'common filler filler');
    ins.run(5, 'delta', 'common filler');
    ins.run(6, 'epsilon', 'common alpha filler filler filler filler');
    return db;
  }

  test('a 25-line reference implementation reproduces bm25() to 1e-12, including column weights', () => {
    const db = corpus();
    for (const [match, terms, weights, args] of [
      ['rare', ['rare'], {}, ''],
      ['rare OR alpha', ['rare', 'alpha'], {}, ''],
      ['rare OR alpha', ['rare', 'alpha'], { title: 10, body: 1 }, ', 10.0, 1.0'],
    ] as const) {
      const expected = referenceBm25(db, 'doc', [...terms], { ...weights });
      const rows = db
        .prepare(`SELECT rowid, bm25(doc${args}) AS s FROM doc WHERE doc MATCH ?`)
        .all(match) as { rowid: number; s: number }[];
      assert.equal(rows.length, expected.size);
      for (const r of rows)
        assert.ok(
          Math.abs(r.s - expected.get(r.rowid)!) < 1e-12,
          `${match} rowid ${r.rowid}: ${r.s} vs ${expected.get(r.rowid)}`,
        );
    }
  });

  test('a term present in more than half of the rows gets the IDF floor of 1e-6, so it barely ranks anything', () => {
    const db = corpus();
    // "common" occurs in all 6 rows: ln((6 - 6 + 0.5) / (6 + 0.5)) < 0, replaced by 1e-6.
    const scores = col(db, "SELECT bm25(doc) FROM doc WHERE doc MATCH 'common'") as number[];
    assert.equal(scores.length, 6);
    for (const s of scores) assert.ok(s < 0 && s > -1e-5, `score ${s}`);
    const ref = referenceBm25(db, 'doc', ['common']);
    assert.ok([...ref.values()].every((v) => v > -1e-5));
  });

  test('the length D used by BM25 is the sum of the varints in <table>_docsize', () => {
    const db = corpus();
    // row 3: title "beta" = 1 token, body = 10 tokens
    assert.equal(rowLengths(db, 'doc').get(3), 11);
    assert.equal(rowLengths(db, 'doc').size, 6);
  });

  test('every committed write adds a level-0 segment; merging keeps the count far below the number of writes; optimize leaves one', () => {
    const db = open();
    db.exec('CREATE VIRTUAL TABLE log USING fts5(body)');
    const ins = db.prepare('INSERT INTO log(body) VALUES (?)');
    ins.run('first row');
    assert.equal(segmentCount(fts5Structure(db, 'log')), 1);
    ins.run('second row');
    ins.run('third row');
    assert.equal(
      segmentCount(fts5Structure(db, 'log')),
      3,
      'three autocommit writes, three segments',
    );
    for (let i = 4; i <= 300; i++) ins.run(`row ${i} common text ${i * 7919}`);
    const many = segmentCount(fts5Structure(db, 'log'));
    assert.ok(many > 1 && many < 60, `300 writes left ${many} segments`);
    db.exec("INSERT INTO log(log) VALUES ('optimize')");
    assert.equal(segmentCount(fts5Structure(db, 'log')), 1);
    db.exec("INSERT INTO log(log) VALUES ('integrity-check')");
    assert.equal(scalar(db, "SELECT count(*) FROM log WHERE log MATCH 'common'"), 297);
  });

  test('one transaction around many inserts writes a single segment', () => {
    const db = open();
    db.exec('CREATE VIRTUAL TABLE log USING fts5(body)');
    const ins = db.prepare('INSERT INTO log(body) VALUES (?)');
    db.transaction(() => {
      for (let i = 0; i < 200; i++) ins.run(`row ${i}`);
    })();
    assert.equal(segmentCount(fts5Structure(db, 'log')), 1);
  });

  test("prefix='2 3' builds extra indexes: larger shadow table, same answers", () => {
    const db = open();
    db.exec(
      "CREATE VIRTUAL TABLE p0 USING fts5(body); CREATE VIRTUAL TABLE p2 USING fts5(body, prefix='2 3')",
    );
    db.transaction(() => {
      for (const t of ['p0', 'p2']) {
        const ins = db.prepare(`INSERT INTO ${t}(rowid, body) VALUES (?, ?)`);
        for (let i = 0; i < 500; i++)
          ins.run(i + 1, `lorem${i.toString(36)} ipsum${(i * 7).toString(36)} dolor sit amet`);
      }
    })();
    const size = (t: string) => scalar<number>(db, `SELECT sum(length(block)) FROM ${t}_data`);
    assert.ok(size('p2') > size('p0') * 1.5, `${size('p2')} vs ${size('p0')}`);
    for (const m of ['lor*', 'lorem1*', 'ipsum1a*']) {
      assert.deepEqual(
        col(db, 'SELECT rowid FROM p2 WHERE p2 MATCH ? ORDER BY 1', m),
        col(db, 'SELECT rowid FROM p0 WHERE p0 MATCH ? ORDER BY 1', m),
      );
    }
  });

  test('negative: detail=column forbids phrases and NEAR; detail=none also forbids column filters', () => {
    const mk = (detail: string) => {
      const db = open();
      db.exec(`CREATE VIRTUAL TABLE t USING fts5(a, b, detail=${detail})`);
      db.exec("INSERT INTO t VALUES ('x y', 'z')");
      return (m: string) => db.prepare('SELECT rowid FROM t WHERE t MATCH ?').all(m);
    };
    const column = mk('column');
    assert.throws(() => column('"x y"'), /phrase queries are not supported/);
    assert.throws(() => column('NEAR(x y)'), /NEAR queries are not supported/);
    assert.deepEqual(column('a:x'), [{ rowid: 1 }], 'column filters still work with detail=column');
    const none = mk('none');
    assert.throws(() => none('a:x'), /column queries are not supported/);
    assert.deepEqual(none('x'), [{ rowid: 1 }]);
  });

  test('contentless tables return NULL columns and refuse DELETE; contentless_delete=1 allows it', () => {
    const db = open();
    db.exec("CREATE VIRTUAL TABLE c USING fts5(body, content='')");
    db.exec("INSERT INTO c(rowid, body) VALUES (1, 'hello world')");
    assert.deepEqual(db.prepare("SELECT rowid, body FROM c WHERE c MATCH 'hello'").all(), [
      { rowid: 1, body: null },
    ]);
    assert.throws(
      () => db.exec('DELETE FROM c WHERE rowid = 1'),
      /cannot DELETE from contentless fts5 table/,
    );
    db.exec("CREATE VIRTUAL TABLE cd USING fts5(body, content='', contentless_delete=1)");
    db.exec("INSERT INTO cd(rowid, body) VALUES (1, 'hello world')");
    db.exec('DELETE FROM cd WHERE rowid = 1');
    assert.equal(scalar(db, "SELECT count(*) FROM cd WHERE cd MATCH 'hello'"), 0);
  });
});

describe('trigram tokenizer details and Geopoly', () => {
  test('trigram with remove_diacritics 1 matches unaccented input; the options conflict with case_sensitive 1', () => {
    const db = open();
    db.exec("CREATE VIRTUAL TABLE tg USING fts5(x, tokenize = 'trigram remove_diacritics 1')");
    db.exec("INSERT INTO tg VALUES ('příliš žluťoučký kůň')");
    assert.equal(scalar(db, "SELECT count(*) FROM tg WHERE tg MATCH 'zlutou'"), 1);
    assert.equal(
      scalar(db, "SELECT count(*) FROM tg WHERE tg MATCH 'lis z'"),
      1,
      'a substring crossing a word boundary',
    );
    assert.throws(
      () =>
        db.exec(
          "CREATE VIRTUAL TABLE bad USING fts5(x, tokenize = 'trigram case_sensitive 1 remove_diacritics 1')",
        ),
      /tokenizer/,
    );
  });

  test('a query shorter than three characters finds nothing in a trigram index', () => {
    const db = open();
    db.exec("CREATE VIRTUAL TABLE tg USING fts5(x, tokenize = 'trigram')");
    db.exec("INSERT INTO tg VALUES ('sqlite')");
    assert.equal(scalar(db, "SELECT count(*) FROM tg WHERE tg MATCH 'sq'"), 0);
    assert.equal(scalar(db, "SELECT count(*) FROM tg WHERE tg MATCH 'sql'"), 1);
  });

  test('Geopoly: exact polygon predicates on top of the R*Tree bounding box', () => {
    const db = open();
    db.exec('CREATE VIRTUAL TABLE gp USING geopoly(name)');
    db.exec(
      "INSERT INTO gp(_shape, name) VALUES ('[[0,0],[10,0],[10,10],[0,10],[0,0]]', 'square')",
    );
    db.exec("INSERT INTO gp(_shape, name) VALUES ('[[0,0],[10,0],[0,10],[0,0]]', 'triangle')");
    const q = (sql: string, ...p: unknown[]) => col(db, sql, ...p);
    assert.deepEqual(q('SELECT geopoly_area(_shape) FROM gp ORDER BY rowid'), [100, 50]);
    // geopoly_contains_point: 2 = strictly inside, 1 = on the boundary, 0 = outside
    assert.deepEqual(
      q('SELECT geopoly_contains_point(_shape, 5, 5) FROM gp ORDER BY rowid'),
      [2, 1],
    );
    assert.deepEqual(
      q('SELECT geopoly_contains_point(_shape, 8, 8) FROM gp ORDER BY rowid'),
      [2, 0],
      'inside the square, outside the triangle',
    );
    assert.deepEqual(
      q(
        "SELECT name FROM gp WHERE geopoly_overlap(_shape, '[[9,9],[20,9],[20,20],[9,20],[9,9]]') ORDER BY rowid",
      ),
      ['square'],
    );
    assert.deepEqual(
      q(
        "SELECT name FROM gp WHERE geopoly_within(_shape, '[[-1,-1],[11,-1],[11,11],[-1,11],[-1,-1]]') ORDER BY rowid",
      ),
      ['square', 'triangle'],
    );
  });
});

describe('virtual-table strategies are visible in the plan', () => {
  // FTS5_BI_* bit flags from ext/fts5/fts5_main.c
  const FTS5 = {
    MATCH: 0x1,
    RANK: 0x2,
    ROWID_EQ: 0x4,
    ROWID_LE: 0x8,
    ROWID_GE: 0x10,
    ORDER_RANK: 0x20,
    ORDER_ROWID: 0x40,
    ORDER_DESC: 0x80,
  };
  const strategy = (db: Db, sql: string): { idxNum: number; idxStr: string } => {
    const m = /VIRTUAL TABLE INDEX (\d+):(.*)$/m.exec(plan(db, sql));
    assert.ok(m, `no virtual-table strategy in: ${plan(db, sql)}`);
    return { idxNum: Number(m[1]), idxStr: m[2] ?? '' };
  };

  test('FTS5 encodes its strategy as a bit mask (idxNum) plus a constraint string (idxStr)', () => {
    const db = open();
    db.exec("CREATE VIRTUAL TABLE doc USING fts5(title, body); INSERT INTO doc VALUES ('a', 'b')");
    assert.deepEqual(strategy(db, 'SELECT * FROM doc'), { idxNum: 0, idxStr: '' }, 'full scan');
    assert.deepEqual(
      strategy(db, "SELECT * FROM doc WHERE doc MATCH 'a'"),
      { idxNum: 0, idxStr: 'M2' },
      'M + column number; the table-name column is number 2 here',
    );
    assert.deepEqual(
      strategy(db, "SELECT * FROM doc WHERE title MATCH 'a'"),
      { idxNum: 0, idxStr: 'M0' },
      'a column-restricted MATCH names column 0',
    );
    assert.deepEqual(strategy(db, 'SELECT * FROM doc WHERE rowid = 1'), { idxNum: 0, idxStr: '=' });
    assert.equal(
      strategy(db, "SELECT * FROM doc WHERE doc MATCH 'a' ORDER BY rank").idxNum,
      FTS5.ORDER_RANK,
      'sorted by rank without a sorter',
    );
    assert.equal(
      strategy(db, "SELECT * FROM doc WHERE doc MATCH 'a' ORDER BY rowid").idxNum,
      FTS5.ORDER_ROWID,
    );
    assert.equal(
      strategy(db, "SELECT * FROM doc WHERE doc MATCH 'a' ORDER BY rowid DESC").idxNum,
      FTS5.ORDER_ROWID | FTS5.ORDER_DESC,
    );
    assert.equal(strategy(db, "SELECT * FROM doc WHERE doc MATCH 'a' AND rowid > 0").idxStr, 'M2>');
  });

  test('R*Tree: strategy 1 is a rowid lookup, strategy 2 a tree walk whose idxStr lists operator and coordinate pairs', () => {
    const db = open();
    db.exec('CREATE VIRTUAL TABLE r USING rtree(id, x0, x1)');
    assert.equal(strategy(db, 'SELECT * FROM r WHERE id = 3').idxNum, 1);
    // operator letters from rtree.c: A '=', B '<=', C '<', D '>=', E '>'; digit = coordinate column
    assert.deepEqual(strategy(db, 'SELECT * FROM r WHERE x0 > 1 AND x1 < 5'), {
      idxNum: 2,
      idxStr: 'E0C1',
    });
    assert.deepEqual(strategy(db, 'SELECT * FROM r WHERE x1 >= 5'), { idxNum: 2, idxStr: 'D1' });
  });

  test('a table-valued function is re-run for every outer row of a join, and rows are produced lazily', () => {
    const db = open();
    let calls = 0;
    let yields = 0;
    db.table('series', {
      columns: ['value'],
      parameters: ['start', 'stop'],
      *rows(start: unknown, stop: unknown) {
        calls++;
        for (let i = Number(start); i <= Number(stop); i++) {
          yields++;
          yield { value: i };
        }
      },
    });
    db.exec('CREATE TABLE t(n); INSERT INTO t VALUES (1), (2), (3)');
    assert.equal(db.prepare('SELECT t.n, s.value FROM t, series(1, t.n) s').all().length, 6);
    assert.equal(calls, 3, 'xFilter runs once per outer row');
    assert.equal(yields, 6);
    calls = 0;
    yields = 0;
    assert.deepEqual(col(db, 'SELECT value FROM series(1, 1000000) LIMIT 3'), [1, 2, 3]);
    assert.equal(yields, 3, 'LIMIT stops the generator: a million-row series costs three steps');
  });

  test('negative: a table-valued function called without its arguments yields no rows rather than an error', () => {
    const db = open();
    db.table('series', {
      columns: ['value'],
      parameters: ['start', 'stop'],
      *rows(start: unknown, stop: unknown) {
        for (let i = Number(start); i <= Number(stop); i++) yield { value: i };
      },
    });
    assert.deepEqual(db.prepare('SELECT * FROM series').all(), []);
  });
});

describe('external content: the delete command must receive the OLD values', () => {
  test('negative: an UPDATE trigger that passes new.* to the delete command leaves stale tokens; integrity-check with rank 1 detects it', () => {
    const db = open();
    db.exec(`CREATE TABLE note(id INTEGER PRIMARY KEY, body TEXT NOT NULL);
      CREATE VIRTUAL TABLE f USING fts5(body, content = 'note', content_rowid = 'id');
      CREATE TRIGGER ai AFTER INSERT ON note BEGIN INSERT INTO f(rowid, body) VALUES (new.id, new.body); END;
      CREATE TRIGGER au AFTER UPDATE ON note BEGIN
        INSERT INTO f(f, rowid, body) VALUES ('delete', new.id, new.body);   -- BUG: must be old.*
        INSERT INTO f(rowid, body) VALUES (new.id, new.body); END;
      INSERT INTO note(body) VALUES ('alpha beta');`);
    db.exec("INSERT INTO f(f, rank) VALUES ('integrity-check', 1)");
    db.exec("UPDATE note SET body = 'gamma delta' WHERE id = 1");
    assert.deepEqual(
      col(db, "SELECT rowid FROM f WHERE f MATCH 'alpha'"),
      [1],
      'the old text is still indexed',
    );
    db.exec("INSERT INTO f(f) VALUES ('integrity-check')"); // the plain check compares the index with itself: passes
    assert.equal(
      errorCode(() => db.exec("INSERT INTO f(f, rank) VALUES ('integrity-check', 1)")),
      'SQLITE_CORRUPT_VTAB',
    );
    db.exec("INSERT INTO f(f) VALUES ('rebuild')");
    db.exec("INSERT INTO f(f, rank) VALUES ('integrity-check', 1)");
    assert.deepEqual(col(db, "SELECT rowid FROM f WHERE f MATCH 'alpha'"), []);
  });
});
