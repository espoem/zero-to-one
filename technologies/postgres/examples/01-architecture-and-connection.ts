import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: PostgreSQL Engine Version & Catalog Introspection
  const verResult = await db.query<{ version: string }>('SELECT version();');
  assert.ok(verResult.rows.length > 0);
  assert.match(verResult.rows[0]!.version, /PostgreSQL/i);

  // Test 2: Memory & Cluster Parameters
  const paramResult = await db.query<{ setting: string }>('SHOW shared_buffers;');
  assert.ok(paramResult.rows.length > 0);

  // Test 3: Catalog verification of tablespaces and databases
  const dbCatalog = await db.query<{ datname: string }>('SELECT datname FROM pg_database WHERE datname = current_database();');
  assert.ok(dbCatalog.rows.length > 0);

  logSuccess('01-architecture-and-connection');
}

await run();
