import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: JSONB Data Manipulation & Containment
  await db.exec(`
    CREATE TABLE products_meta (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      attributes JSONB NOT NULL
    );

    INSERT INTO products_meta (name, attributes) VALUES
      ('Laptop', '{"brand": "Acme", "specs": {"ram": 32, "storage": 1000}, "tags": ["tech", "portable"]}'::jsonb),
      ('Desk', '{"brand": "Woodcraft", "specs": {"height": 75}, "tags": ["furniture"]}'::jsonb);
  `);

  // Access operators -> and ->>
  const extractResult = await db.query<{ brand: string; ram: number }>(`
    SELECT 
      attributes->>'brand' AS brand,
      (attributes#>>'{specs, ram}')::int AS ram
    FROM products_meta
    WHERE attributes @> '{"brand": "Acme"}'::jsonb;
  `);
  assert.equal(extractResult.rows.length, 1);
  assert.equal(extractResult.rows[0]!.brand, 'Acme');
  assert.equal(extractResult.rows[0]!.ram, 32);

  // Key existence ? and Array containment @>
  const tagResult = await db.query<{ name: string }>(`
    SELECT name FROM products_meta WHERE attributes->'tags' @> '["portable"]'::jsonb;
  `);
  assert.equal(tagResult.rows.length, 1);
  assert.equal(tagResult.rows[0]!.name, 'Laptop');

  // JSONB Mutation: Concatenation || and Deletion -
  await db.query(`
    UPDATE products_meta 
    SET attributes = (attributes || '{"warranty_years": 3}'::jsonb) - 'tags'
    WHERE name = 'Laptop';
  `);
  const updatedMeta = await db.query<{ attributes: Record<string, unknown> }>(`
    SELECT attributes FROM products_meta WHERE name = 'Laptop';
  `);
  assert.equal(updatedMeta.rows[0]!.attributes.warranty_years, 3);
  assert.equal(updatedMeta.rows[0]!.attributes.tags, undefined);

  // Test 2: Native Full-Text Search (tsvector @@ tsquery)
  await db.exec(`
    CREATE TABLE articles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL
    );

    INSERT INTO articles (title, body) VALUES
      ('PostgreSQL 18 Release', 'PostgreSQL 18 contains asynchronous IO and performance improvements.'),
      ('Web Development', 'Building web applications using TypeScript and Node.js.');
  `);

  const searchResult = await db.query<{ title: string }>(`
    SELECT title FROM articles
    WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', 'postgresql & asynchronous');
  `);
  assert.equal(searchResult.rows.length, 1);
  assert.equal(searchResult.rows[0]!.title, 'PostgreSQL 18 Release');

  logSuccess('05-jsonb-and-full-text-search');
}

await run();
