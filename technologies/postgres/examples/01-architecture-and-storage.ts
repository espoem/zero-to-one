import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: PostgreSQL Engine Version & Catalog Introspection
  const verResult = await db.query<{ version: string }>('SELECT version();');
  assert.ok(verResult.rows.length > 0);
  assert.match(verResult.rows[0]!.version, /PostgreSQL/i);

  // Test 2: Memory & Block Parameters
  const paramResult = await db.query<{ shared_buffers: string }>('SHOW shared_buffers;');
  assert.ok(paramResult.rows.length > 0);

  const blockSizeResult = await db.query<{ block_size: string }>('SHOW block_size;');
  assert.equal(blockSizeResult.rows[0]!.block_size, '8192', 'Block size must be 8192 bytes (8KB)');

  // Test 3: Catalog verification of tablespaces and databases
  const dbCatalog = await db.query<{ datname: string }>('SELECT datname FROM pg_database WHERE datname = current_database();');
  assert.ok(dbCatalog.rows.length > 0);

  // Test 4: Physical storage relation fork inspection via pg_class
  await db.exec('CREATE TABLE storage_test (id INT PRIMARY KEY, payload TEXT);');
  const classResult = await db.query<{ relfilenode: number, relhasindex: boolean }>(
    "SELECT relfilenode, relhasindex FROM pg_class WHERE relname = 'storage_test';"
  );
  assert.ok(classResult.rows.length > 0);
  assert.equal(classResult.rows[0]!.relhasindex, true);

  logSuccess('01-architecture-and-storage');
}

await run();
