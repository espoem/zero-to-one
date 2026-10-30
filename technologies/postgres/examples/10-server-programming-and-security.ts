import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: PL/pgSQL Function with Structured Exception Handling
  await db.exec(`
    CREATE OR REPLACE FUNCTION safe_divide(a NUMERIC, b NUMERIC)
    RETURNS NUMERIC
    LANGUAGE plpgsql
    IMMUTABLE
    AS $$
    BEGIN
      RETURN a / b;
    EXCEPTION
      WHEN division_by_zero THEN
        RETURN 0;
    END;
    $$;
  `);

  const divNormal = await db.query<{ res: string }>('SELECT safe_divide(10, 2) AS res;');
  assert.equal(Number(divNormal.rows[0]!.res), 5);

  const divZero = await db.query<{ res: string }>('SELECT safe_divide(10, 0) AS res;');
  assert.equal(Number(divZero.rows[0]!.res), 0);

  // Test 2: Multi-Tenant Row-Level Security (RLS) Policy
  await db.exec(`
    CREATE ROLE tenant_client;

    CREATE TABLE documents (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL,
      title TEXT NOT NULL
    );

    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON documents TO tenant_client;

    CREATE POLICY tenant_isolation_policy ON documents
      FOR ALL
      TO tenant_client
      USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::int);

    INSERT INTO documents (tenant_id, title) VALUES
      (1, 'Doc Tenant 1 Confidential'),
      (2, 'Doc Tenant 2 Confidential');
  `);

  // Switch to tenant_client role
  await db.exec('SET ROLE tenant_client;');

  // Without tenant context, 0 rows returned
  const emptyRes = await db.query('SELECT * FROM documents;');
  assert.equal(emptyRes.rows.length, 0);

  // Set tenant 1 context
  await db.exec("SET app.current_tenant = '1';");
  const t1Res = await db.query<{ title: string }>('SELECT title FROM documents;');
  assert.equal(t1Res.rows.length, 1);
  assert.equal(t1Res.rows[0]!.title, 'Doc Tenant 1 Confidential');

  // Reset role
  await db.exec('RESET ROLE;');

  logSuccess('10-server-programming-and-security');
}

await run();
