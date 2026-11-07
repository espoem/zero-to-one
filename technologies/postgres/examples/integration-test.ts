import assert from 'node:assert/strict';
import net from 'node:net';
import pg from 'pg';

const { Client } = pg;

function checkPostgresReachable(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function run(): Promise<void> {
  const host = process.env.PGHOST || '127.0.0.1';
  const port = Number(process.env.PGPORT || 5432);

  const reachable = await checkPostgresReachable(host, port);
  if (!reachable) {
    console.log(
      `[SKIP] Integration test: Docker PostgreSQL instance not reachable on ${host}:${port}. Start with 'docker compose up -d'.`,
    );
    process.exit(0);
  }

  const connectionString = `postgres://postgres:postgrespassword@${host}:${port}/training_db`;

  // 1. Version check against live PostgreSQL
  const client1 = new Client({ connectionString });
  await client1.connect();
  const versionRes = await client1.query<{ version: string }>('SELECT version()');
  console.log(`[INFO] Connected to: ${versionRes.rows[0]?.version}`);
  assert.ok(
    versionRes.rows[0]?.version.includes('PostgreSQL 18'),
    'Expected PostgreSQL 18 runtime in Docker container',
  );

  // Setup test table
  await client1.query(`
    DROP TABLE IF EXISTS integration_mvcc_test;
    CREATE TABLE integration_mvcc_test (id INT PRIMARY KEY, val TEXT);
    INSERT INTO integration_mvcc_test VALUES (1, 'initial');
  `);

  // 2. Multi-session MVCC snapshot isolation proof
  const client2 = new Client({ connectionString });
  await client2.connect();

  // Client 1 begins Repeatable Read transaction
  await client1.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  const read1 = await client1.query<{ val: string }>(
    'SELECT val FROM integration_mvcc_test WHERE id = 1',
  );
  assert.equal(read1.rows[0]?.val, 'initial');

  // Client 2 updates and commits
  await client2.query("UPDATE integration_mvcc_test SET val = 'updated_by_c2' WHERE id = 1");

  // Client 1 reads again - must still see 'initial' under Repeatable Read snapshot
  const read2 = await client1.query<{ val: string }>(
    'SELECT val FROM integration_mvcc_test WHERE id = 1',
  );
  assert.equal(
    read2.rows[0]?.val,
    'initial',
    'Repeatable Read must maintain snapshot isolation across concurrent commits',
  );

  await client1.query('COMMIT');

  // Post-commit client 1 sees the new state
  const read3 = await client1.query<{ val: string }>(
    'SELECT val FROM integration_mvcc_test WHERE id = 1',
  );
  assert.equal(read3.rows[0]?.val, 'updated_by_c2');

  // Clean up
  await client1.query('DROP TABLE integration_mvcc_test');
  await client1.end();
  await client2.end();

  console.log(`[PASS] integration-test: PostgreSQL reachable and MVCC verified on ${host}:${port}`);
}

await run();
