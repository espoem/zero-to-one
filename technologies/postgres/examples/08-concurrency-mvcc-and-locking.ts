import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  await db.exec(`
    CREATE TABLE accounts (
      id INT PRIMARY KEY,
      balance NUMERIC(10, 2) NOT NULL
    );

    INSERT INTO accounts VALUES (1, 100.00), (2, 50.00);
  `);

  // Test 1: Atomicity & Rollback Mechanics
  try {
    await db.exec(`
      BEGIN;
      UPDATE accounts SET balance = balance - 20 WHERE id = 1;
      UPDATE accounts SET balance = balance + 20 WHERE id = 2;
      -- Force rollback
      ROLLBACK;
    `);
  } catch {
    // Expected simulation
  }

  const balCheck = await db.query<{ balance: string }>('SELECT balance FROM accounts WHERE id = 1;');
  assert.equal(Number(balCheck.rows[0]!.balance), 100.00, 'Rollback must preserve original balance');

  // Test 2: Successful Transactional Transfer
  await db.exec(`
    BEGIN;
    UPDATE accounts SET balance = balance - 30 WHERE id = 1;
    UPDATE accounts SET balance = balance + 30 WHERE id = 2;
    COMMIT;
  `);

  const balAfterCommit = await db.query<{ id: number; balance: string }>('SELECT id, balance FROM accounts ORDER BY id ASC;');
  assert.equal(Number(balAfterCommit.rows[0]!.balance), 70.00);
  assert.equal(Number(balAfterCommit.rows[1]!.balance), 80.00);

  // Test 3: Transaction-Level Advisory Locks
  await db.exec(`
    BEGIN;
    SELECT pg_advisory_xact_lock(101);
    COMMIT;
  `);

  // Test 4: Work Queue with FOR UPDATE SKIP LOCKED
  await db.exec(`
    CREATE TABLE job_queue (
      job_id SERIAL PRIMARY KEY,
      task_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    INSERT INTO job_queue (task_name) VALUES ('job_alpha'), ('job_beta');
  `);

  const jobFetch = await db.query<{ job_id: number; task_name: string }>(`
    SELECT job_id, task_name
    FROM job_queue
    WHERE status = 'pending'
    ORDER BY job_id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  `);
  assert.equal(jobFetch.rows.length, 1);
  assert.equal(jobFetch.rows[0]!.task_name, 'job_alpha');

  logSuccess('08-concurrency-mvcc-and-locking');
}

await run();
