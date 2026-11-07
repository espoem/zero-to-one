// Module 12: libSQL embedded replica against a real primary (Turso Cloud or a local sqld).
// Requires TURSO_DATABASE_URL (libsql://... or http://127.0.0.1:8080) and, for Turso Cloud, TURSO_AUTH_TOKEN.
// Skips with a message when they are absent, so `npm run test:integration` is safe everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';

const url = process.env['TURSO_DATABASE_URL'];
const authToken = process.env['TURSO_AUTH_TOKEN'];
const skip = url
  ? false
  : 'TURSO_DATABASE_URL not set: needs a Turso Cloud database or a local sqld (Docker); skipping';

test(
  'embedded replica: reads are local, writes go to the primary, sync() pulls frames',
  { skip },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'replica-'));
    try {
      const primary = createClient({ url: url!, ...(authToken ? { authToken } : {}) });
      const replica = createClient({
        url: `file:${join(dir, 'replica.db')}`,
        syncUrl: url!,
        ...(authToken ? { authToken } : {}),
        readYourWrites: false, // make the staleness window visible
      });
      await primary.execute(
        'CREATE TABLE IF NOT EXISTS zto_replica_probe(id INTEGER PRIMARY KEY, v TEXT)',
      );
      await replica.sync();
      const marker = `m-${Date.now()}`;
      await primary.execute({ sql: 'INSERT INTO zto_replica_probe(v) VALUES (?)', args: [marker] });
      const before = await replica.execute({
        sql: 'SELECT count(*) AS n FROM zto_replica_probe WHERE v = ?',
        args: [marker],
      });
      assert.equal(before.rows[0]?.['n'], 0, 'local replica is stale until sync()');
      await replica.sync();
      const after = await replica.execute({
        sql: 'SELECT count(*) AS n FROM zto_replica_probe WHERE v = ?',
        args: [marker],
      });
      assert.equal(after.rows[0]?.['n'], 1);
      await primary.execute({ sql: 'DELETE FROM zto_replica_probe WHERE v = ?', args: [marker] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
