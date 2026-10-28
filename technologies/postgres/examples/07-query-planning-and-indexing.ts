import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  await db.exec(`
    CREATE TABLE audit_logs (
      log_id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );

    -- Partial Index: only index high-severity errors
    CREATE INDEX idx_audit_critical ON audit_logs (created_at) WHERE severity = 'CRITICAL';

    -- Covering Index with INCLUDE
    CREATE INDEX idx_audit_tenant_cov ON audit_logs (tenant_id) INCLUDE (severity);

    -- Populate sample records
    INSERT INTO audit_logs (tenant_id, severity, message) VALUES
      (1, 'INFO', 'User logged in'),
      (1, 'CRITICAL', 'Disk full alert'),
      (2, 'INFO', 'Job started'),
      (2, 'CRITICAL', 'Service unreachable');
  `);

  // Test 1: EXPLAIN plan generation
  const explainResult = await db.query<{ ['QUERY PLAN']: string }>(`
    EXPLAIN SELECT * FROM audit_logs WHERE severity = 'CRITICAL';
  `);
  assert.ok(explainResult.rows.length > 0);
  assert.ok(explainResult.rows.some(r => r['QUERY PLAN'].includes('Scan')));

  // Test 2: Index validation query
  const queryResult = await db.query<{ message: string }>(`
    SELECT message FROM audit_logs WHERE severity = 'CRITICAL' ORDER BY created_at ASC;
  `);
  assert.equal(queryResult.rows.length, 2);
  assert.equal(queryResult.rows[0]!.message, 'Disk full alert');

  logSuccess('07-query-planning-and-indexing');
}

await run();
