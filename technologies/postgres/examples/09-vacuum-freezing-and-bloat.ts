import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Fillfactor Configuration for HOT (Heap-Only Tuples) Updates
  await db.exec(`
    CREATE TABLE high_churn_sessions (
      session_id INT PRIMARY KEY,
      last_active TIMESTAMPTZ NOT NULL,
      payload TEXT
    ) WITH (fillfactor = 85);

    INSERT INTO high_churn_sessions VALUES (1, NOW(), 'initial');
  `);

  const relOpts = await db.query<{ reloptions: string[] }>(`
    SELECT reloptions FROM pg_class WHERE relname = 'high_churn_sessions';
  `);
  assert.ok(relOpts.rows[0]!.reloptions.some(opt => opt.includes('fillfactor=85')));

  // Test 2: Dead Tuple Generation & In-Engine VACUUM Reclaim
  await db.exec(`
    CREATE TABLE bloat_target (id INT, counter INT);
    INSERT INTO bloat_target VALUES (1, 100);

    -- Repeated updates create dead tuples
    UPDATE bloat_target SET counter = 101 WHERE id = 1;
    UPDATE bloat_target SET counter = 102 WHERE id = 1;
    UPDATE bloat_target SET counter = 103 WHERE id = 1;
  `);

  // Run VACUUM to reclaim space within 8KB page for future inserts
  await db.exec('VACUUM bloat_target;');

  const valCheck = await db.query<{ counter: number }>('SELECT counter FROM bloat_target WHERE id = 1;');
  assert.equal(valCheck.rows[0]!.counter, 103);

  // Test 3: Autovacuum Tuning Configuration Per Table
  await db.exec(`
    ALTER TABLE high_churn_sessions SET (
      autovacuum_vacuum_scale_factor = 0.02,
      autovacuum_vacuum_threshold = 1000
    );
  `);

  const updatedOpts = await db.query<{ reloptions: string[] }>(`
    SELECT reloptions FROM pg_class WHERE relname = 'high_churn_sessions';
  `);
  assert.ok(updatedOpts.rows[0]!.reloptions.some(opt => opt.includes('autovacuum_vacuum_scale_factor=0.02')));

  logSuccess('09-vacuum-freezing-and-bloat');
}

await run();
