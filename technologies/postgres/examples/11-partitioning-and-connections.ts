import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Declarative Range Partitioning
  await db.exec(`
    CREATE TABLE audit_events (
      event_id BIGINT GENERATED ALWAYS AS IDENTITY,
      event_date DATE NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (event_date, event_id)
    ) PARTITION BY RANGE (event_date);

    CREATE TABLE audit_events_2025 PARTITION OF audit_events
      FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

    CREATE TABLE audit_events_2026 PARTITION OF audit_events
      FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

    INSERT INTO audit_events (event_date, payload) VALUES
      ('2025-05-10', 'Event 2025'),
      ('2026-02-14', 'Event 2026');
  `);

  const count2025 = await db.query('SELECT * FROM audit_events_2025;');
  assert.equal(count2025.rows.length, 1);

  const count2026 = await db.query('SELECT * FROM audit_events_2026;');
  assert.equal(count2026.rows.length, 1);

  // Test 2: Partition Pruning Plan Verification
  const explainPrune = await db.query<{ 'QUERY PLAN': string }>(
    "EXPLAIN SELECT * FROM audit_events WHERE event_date = '2026-02-14';"
  );
  const planText = explainPrune.rows.map(r => r['QUERY PLAN']).join('\n');
  assert.match(planText, /audit_events_2026/);
  assert.doesNotMatch(planText, /audit_events_2025/);

  // Test 3: Zero-Downtime Migration Pattern: NOT VALID Constraint & Validation
  await db.exec(`
    CREATE TABLE migration_orders (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(10,2) NOT NULL
    );

    INSERT INTO migration_orders (amount) VALUES (150.00), (200.00);

    -- Phase 1: Add check constraint NOT VALID (instant catalog lock)
    ALTER TABLE migration_orders 
    ADD CONSTRAINT check_positive_amount CHECK (amount > 0) NOT VALID;

    -- Phase 2: Online validation without exclusive lock
    ALTER TABLE migration_orders 
    VALIDATE CONSTRAINT check_positive_amount;
  `);

  const constraintCheck = await db.query<{ convalidated: boolean }>(`
    SELECT convalidated FROM pg_constraint WHERE conname = 'check_positive_amount';
  `);
  assert.equal(constraintCheck.rows[0]!.convalidated, true);

  logSuccess('11-partitioning-and-connections');
}

await run();
