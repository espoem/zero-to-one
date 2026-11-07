// Shared helpers for the SQLite track's executable proofs.
// Every suite asserts the engine version it actually runs against, because each
// binding bundles its own copy of SQLite (see README § Bindings and bundled SQLite versions).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

/** Engine versions bundled by the pinned bindings (package.json is pinned exactly). */
export const BUNDLED = {
  betterSqlite3: '3.53.4', // better-sqlite3 13.0.3
  nodeSqlite: '3.54.0', // node:sqlite in Node 26.12.1
  libsql: '3.45.1', // @libsql/client 0.18.0 (libSQL fork)
  turso: '3.50.4', // @tursodatabase/database 0.8.3 (compatibility target, Rust rewrite)
} as const;

export type Db = Database.Database;

/** A throw-away directory for database files. Call `cleanup()` in `after`. */
export function tempDir(prefix = 'sqlite-track-'): {
  dir: string;
  file: (name: string) => string;
  cleanup: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    file: (name: string) => join(dir, name),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Open a better-sqlite3 connection and assert the bundled engine version. */
export function open(path = ':memory:', options: Database.Options = {}): Db {
  const db = new Database(path, options);
  assertVersion(db);
  return db;
}

export function assertVersion(db: Db, expected: string = BUNDLED.betterSqlite3): void {
  const row = db.prepare('SELECT sqlite_version() AS v').get() as { v: string };
  assert.equal(row.v, expected, `better-sqlite3 must bundle SQLite ${expected}`);
}

/** Single scalar helper: first column of the first row. */
export function scalar<T = unknown>(db: Db, sql: string, ...params: unknown[]): T {
  return db
    .prepare(sql)
    .pluck()
    .get(...params) as T;
}

/** Collect the SQLite error code thrown by fn (better-sqlite3 exposes extended codes as strings). */
export function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

/** EXPLAIN QUERY PLAN rendered as the `detail` column joined by newlines. */
export function plan(db: Db, sql: string, ...params: unknown[]): string {
  return (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[])
    .map((r) => r.detail)
    .join('\n');
}
