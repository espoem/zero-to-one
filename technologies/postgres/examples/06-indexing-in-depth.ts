import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  await db.exec(`
    CREATE TABLE articles (
      id SERIAL PRIMARY KEY,
      author_id INT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      view_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );

    INSERT INTO articles (author_id, title, status, view_count) VALUES
      (1, 'PostgreSQL 18 Architecture', 'published', 1500),
      (1, 'B-Tree Skip Scans', 'published', 800),
      (2, 'Draft Notes', 'draft', 10),
      (3, 'Archived Post', 'archived', 50);
  `);

  // Test 1: Partial Index (indexes only published articles)
  await db.exec(`
    CREATE INDEX idx_articles_published 
    ON articles (author_id, created_at) 
    WHERE status = 'published';
  `);

  const partialScan = await db.query<{ title: string }>(`
    SELECT title FROM articles 
    WHERE status = 'published' AND author_id = 1 
    ORDER BY created_at DESC;
  `);
  assert.equal(partialScan.rows.length, 2);

  // Test 2: Expression Index (lower-case title lookups)
  await db.exec(`
    CREATE INDEX idx_articles_lower_title 
    ON articles (lower(title));
  `);

  const exprScan = await db.query<{ id: number }>(`
    SELECT id FROM articles WHERE lower(title) = 'b-tree skip scans';
  `);
  assert.equal(exprScan.rows.length, 1);

  // Test 3: Covering Index with INCLUDE clause for Index-Only Scans
  await db.exec(`
    CREATE INDEX idx_articles_covering 
    ON articles (author_id) 
    INCLUDE (view_count, title);
  `);

  const coveringScan = await db.query<{ title: string; view_count: number }>(`
    SELECT title, view_count FROM articles WHERE author_id = 1 ORDER BY id ASC;
  `);
  assert.equal(coveringScan.rows.length, 2);
  assert.equal(coveringScan.rows[0]!.view_count, 1500);

  logSuccess('06-indexing-in-depth');
}

await run();
