import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Oracle to PostgreSQL Data Type Mapping & Translation Simulation
  // Oracle: NUMBER(10, 2) -> NUMERIC(10, 2), VARCHAR2(100) -> TEXT, DATE -> TIMESTAMPTZ
  await db.exec(`
    CREATE TABLE migrated_oracle_contracts (
      contract_id INT PRIMARY KEY,
      contract_code TEXT NOT NULL,
      amount NUMERIC(15, 2) NOT NULL,
      signed_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'TERMINATED'))
    );

    INSERT INTO migrated_oracle_contracts VALUES
      (101, 'CTR-2026-A', 500000.00, '2026-05-01 10:30:00+00', 'ACTIVE'),
      (102, 'CTR-2026-B', 1250000.50, '2026-08-15 14:00:00+00', 'DRAFT');
  `);

  const contracts = await db.query<{ contract_code: string; amount: string }>(`
    SELECT contract_code, amount FROM migrated_oracle_contracts WHERE status = 'ACTIVE';
  `);
  assert.equal(contracts.rows.length, 1);
  assert.equal(contracts.rows[0]!.contract_code, 'CTR-2026-A');
  assert.equal(Number(contracts.rows[0]!.amount), 500000.00);

  // Test 2: Replication & Backup catalog checks
  const settingsCheck = await db.query<{ name: string }>(`
    SELECT name FROM pg_settings WHERE name IN ('wal_level', 'archive_mode');
  `);
  assert.ok(settingsCheck.rows.length > 0);

  logSuccess('09-backup-pitr-and-migration');
}

await run();
