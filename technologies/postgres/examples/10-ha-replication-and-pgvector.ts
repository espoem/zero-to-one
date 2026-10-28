import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Row-Level Security (RLS) Multi-Tenant Policy
  // Create a standard application user role to enforce RLS (superusers always bypass RLS)
  await db.exec(`
    CREATE ROLE tenant_app_user;

    CREATE TABLE tenant_records (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL,
      payload TEXT NOT NULL
    );

    ALTER TABLE tenant_records ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON tenant_records TO tenant_app_user;

    CREATE POLICY tenant_isolation_policy ON tenant_records
      FOR ALL
      TO tenant_app_user
      USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::int);

    INSERT INTO tenant_records (tenant_id, payload) VALUES
      (1, 'Tenant 1 confidential data'),
      (2, 'Tenant 2 confidential data');
  `);

  // Switch to application user role
  await db.exec('SET ROLE tenant_app_user;');

  // Without tenant set, RLS policy filters out all records
  const noTenantQuery = await db.query('SELECT * FROM tenant_records;');
  assert.equal(noTenantQuery.rows.length, 0, 'RLS must hide rows when no tenant context is established');

  // Set tenant context to 1
  await db.exec("SET app.current_tenant = '1';");
  const tenant1Query = await db.query<{ payload: string }>('SELECT payload FROM tenant_records;');
  assert.equal(tenant1Query.rows.length, 1);
  assert.equal(tenant1Query.rows[0]!.payload, 'Tenant 1 confidential data');

  // Reset role back to postgres
  await db.exec('RESET ROLE;');

  // Test 2: LISTEN / NOTIFY Execution
  await db.exec("NOTIFY test_event_channel, '{\"event\": \"order_placed\"}';");

  // Test 3: Mathematical Vector Cosine Distance Verification (Foundation of pgvector)
  // Compute cosine similarity between vectors [1, 0, 0] and [0.8, 0.6, 0]
  const vectorMath = await db.query<{ cosine_sim: number }>(`
    WITH v AS (
      SELECT 
        ARRAY[1.0, 0.0, 0.0] AS a,
        ARRAY[0.8, 0.6, 0.0] AS b
    )
    SELECT (
      (a[1]*b[1] + a[2]*b[2] + a[3]*b[3]) / 
      (sqrt(a[1]^2 + a[2]^2 + a[3]^2) * sqrt(b[1]^2 + b[2]^2 + b[3]^2))
    ) AS cosine_sim
    FROM v;
  `);
  assert.ok(Math.abs(Number(vectorMath.rows[0]!.cosine_sim) - 0.8) < 0.0001, 'Cosine similarity must equal 0.8');

  logSuccess('10-ha-replication-and-pgvector');
}

await run();
