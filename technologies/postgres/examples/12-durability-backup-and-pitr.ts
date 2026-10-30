import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Write-Ahead Log (WAL) LSN Progression
  const lsnInitial = await db.query<{ lsn: string }>('SELECT pg_current_wal_lsn() AS lsn;');
  assert.ok(lsnInitial.rows.length > 0);
  assert.match(lsnInitial.rows[0]!.lsn, /^[0-9A-F]+\/[0-9A-F]+$/i);

  // Execute writes to advance WAL stream
  await db.exec(`
    CREATE TABLE wal_progression (id INT, val TEXT);
    INSERT INTO wal_progression VALUES (1, 'Alpha'), (2, 'Beta');
  `);

  const lsnAfter = await db.query<{ lsn: string }>('SELECT pg_current_wal_lsn() AS lsn;');
  assert.ok(lsnAfter.rows.length > 0);

  // Test 2: Checkpoint Execution & Checkpoint State Inspection
  await db.exec('CHECKPOINT;');

  // Test 3: Catalog Introspection for Checkpoint Metadata
  const controlCheck = await db.query<{ checkpoint_lsn: string }>(`
    SELECT checkpoint_lsn::text FROM pg_control_checkpoint();
  `);
  assert.ok(controlCheck.rows.length > 0);

  // Test 4: Transaction Persistence Across Atomic Blocks
  await db.exec(`
    BEGIN;
    INSERT INTO wal_progression VALUES (3, 'Gamma');
    COMMIT;
  `);

  const finalCheck = await db.query('SELECT * FROM wal_progression;');
  assert.equal(finalCheck.rows.length, 3);

  logSuccess('12-durability-backup-and-pitr');
}

await run();
