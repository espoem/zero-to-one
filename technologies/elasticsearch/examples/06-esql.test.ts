/**
 * Module 06: ES|QL. Each fixture in fixtures/esql is run by the teaching interpreter in
 * lib/esql.ts against fixtures/esql/dataset.json and must produce exactly the expected
 * columns and rows (or the expected error). Further tests pin down the semantics that
 * differ from SQL and from the Query DSL.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { run, DEFAULT_LIMIT, MAX_LIMIT, type Catalog, type Row } from './lib/esql.ts';

const dir = join(import.meta.dirname, 'fixtures/esql');
const catalog = JSON.parse(readFileSync(join(dir, 'dataset.json'), 'utf8')) as Catalog;

interface Fixture {
  name: string;
  semantics: string;
  query: string;
  expect: { columns?: string[]; rows?: unknown[][]; error?: string };
}

const fixtures = readdirSync(dir)
  .filter((f) => /^\d+-.*\.json$/.test(f))
  .sort();

describe('ES|QL fixtures', () => {
  it('has at least 10 documented fixtures', () => assert.ok(fixtures.length >= 10));
  for (const f of fixtures) {
    const fx = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Fixture;
    it(`${f}: ${fx.name}`, () => {
      assert.ok(fx.semantics.length > 20);
      if (fx.expect.error) {
        assert.throws(() => run(fx.query, catalog), new RegExp(fx.expect.error));
        return;
      }
      const t = run(fx.query, catalog);
      assert.deepEqual(t.columns, fx.expect.columns);
      assert.deepEqual(
        t.rows.map((r) => t.columns.map((c) => r[c] ?? null)),
        fx.expect.rows,
      );
    });
  }
});

describe('ES|QL semantics', () => {
  const big: Catalog = { indices: { big: Array.from({ length: 12000 }, (_, i) => ({ n: i })) } };

  it('applies an implicit LIMIT 1000 and caps explicit limits at 10000', () => {
    assert.equal(run('FROM big', big).rows.length, DEFAULT_LIMIT);
    assert.equal(run('FROM big | LIMIT 50000', big).rows.length, MAX_LIMIT);
  });

  it('the limit truncates output only: STATS still sees every row', () => {
    assert.equal(run('FROM big | STATS c = COUNT(*)', big).rows[0]!['c'], 12000);
  });

  it('COUNT(field) skips NULLs while COUNT(*) counts rows', () => {
    const t = run('FROM employees | STATS rows = COUNT(*), langs = COUNT(languages)', catalog);
    assert.deepEqual(t.rows[0], { rows: 5, langs: 4 });
  });

  it('AVG ignores NULLs (it is not SUM / COUNT(*))', () => {
    const t = run('FROM employees | STATS a = AVG(languages)', catalog);
    assert.equal(t.rows[0]!['a'], 2);
  });

  it('a query must start with a source command', () => {
    assert.throws(() => run('WHERE x > 1', catalog), /source command/);
  });

  it('operators with NULL return NULL (not false)', () => {
    const t = run('ROW a = NULL, b = 1 | EVAL s = a + b, eq = a == NULL, isn = a IS NULL', catalog);
    assert.deepEqual(t.rows[0], { a: null, b: 1, s: null, eq: null, isn: true });
  });

  it('property: WHERE p OR NOT p keeps exactly the rows where p is not NULL', () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.integer({ min: -5, max: 5 }), { nil: null }), { maxLength: 30 }),
        fc.integer({ min: -5, max: 5 }),
        (vals, k) => {
          const cat: Catalog = { indices: { t: vals.map((v): Row => ({ v })) } };
          const kept = run(
            `FROM t | WHERE v > ${k < 0 ? `0 - ${-k}` : k} OR NOT v > ${k < 0 ? `0 - ${-k}` : k} | LIMIT 10000`,
            cat,
          ).rows.length;
          return kept === vals.filter((v) => v !== null).length;
        },
      ),
    );
  });

  it('property: STATS COUNT(*) BY g sums to the input row count', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'c', null), { maxLength: 40 }), (gs) => {
        const all = ['a', ...gs]; // at least one non-null value so the column is mapped
        const cat: Catalog = { indices: { t: all.map((g): Row => ({ g })) } };
        const t = run('FROM t | STATS c = COUNT(*) BY g', cat);
        return t.rows.reduce((n, r) => n + (r['c'] as number), 0) === all.length;
      }),
    );
  });

  it('NULL is its own group in STATS BY', () => {
    const t = run('FROM employees | STATS c = COUNT(*) BY languages | SORT languages', catalog);
    assert.deepEqual(t.rows.at(-1), { c: 1, languages: null });
  });
});
