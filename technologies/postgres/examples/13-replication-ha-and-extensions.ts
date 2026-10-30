import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Mathematical Vector Cosine Distance & L2 Similarity (pgvector Foundations)
  // Prove vector similarity calculation between [1, 0, 0] and [0.8, 0.6, 0]
  const vectorMath = await db.query<{ cosine_sim: number; l2_dist: number }>(`
    WITH v AS (
      SELECT 
        ARRAY[1.0, 0.0, 0.0] AS a,
        ARRAY[0.8, 0.6, 0.0] AS b
    )
    SELECT 
      (
        (a[1]*b[1] + a[2]*b[2] + a[3]*b[3]) / 
        (sqrt(a[1]^2 + a[2]^2 + a[3]^2) * sqrt(b[1]^2 + b[2]^2 + b[3]^2))
      ) AS cosine_sim,
      sqrt((a[1]-b[1])^2 + (a[2]-b[2])^2 + (a[3]-b[3])^2) AS l2_dist
    FROM v;
  `);
  assert.ok(Math.abs(Number(vectorMath.rows[0]!.cosine_sim) - 0.8) < 0.0001, 'Cosine similarity must equal 0.8');
  assert.ok(Math.abs(Number(vectorMath.rows[0]!.l2_dist) - 0.63245) < 0.001, 'L2 distance must equal ~0.632');

  // Test 2: Replication Catalog Introspection (Publications & Slots)
  await db.exec(`
    CREATE TABLE replicated_stream (id INT PRIMARY KEY, message TEXT);
    CREATE PUBLICATION test_pub FOR TABLE replicated_stream;
  `);

  const pubCheck = await db.query<{ pubname: string }>(`
    SELECT pubname FROM pg_publication WHERE pubname = 'test_pub';
  `);
  assert.equal(pubCheck.rows.length, 1);
  assert.equal(pubCheck.rows[0]!.pubname, 'test_pub');

  // Test 3: System Activity & Wait Event Telemetry Query
  const actCheck = await db.query<{ state: string }>(`
    SELECT state FROM pg_stat_activity WHERE pid = pg_backend_pid();
  `);
  assert.ok(actCheck.rows.length > 0);

  logSuccess('13-replication-ha-and-extensions');
}

await run();
