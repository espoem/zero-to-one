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
      -- Simulate a forced rollback
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

  // Test 3: Queuing Pattern with FOR UPDATE
  await db.exec(`
    CREATE TABLE task_queue (
      task_id SERIAL PRIMARY KEY,
      task_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    INSERT INTO task_queue (task_name) VALUES ('email_1'), ('email_2');
  `);

  const taskFetch = await db.query<{ task_id: number; task_name: string }>(`
    SELECT task_id, task_name
    FROM task_queue
    WHERE status = 'pending'
    ORDER BY task_id ASC
    LIMIT 1
    FOR UPDATE;
  `);
  assert.equal(taskFetch.rows.length, 1);
  assert.equal(taskFetch.rows[0]!.task_name, 'email_1');

  // Test 4: Advisory Locks
  const advLock = await db.query<{ lock_acquired: boolean }>('SELECT pg_try_advisory_lock(42) AS lock_acquired;');
  assert.equal(advLock.rows[0]!.lock_acquired, true);
  await db.query('SELECT pg_advisory_unlock(42);');

  logSuccess('06-concurrency-and-mvcc');
}

await run();
