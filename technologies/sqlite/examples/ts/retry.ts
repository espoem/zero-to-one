// A write-transaction wrapper with BEGIN IMMEDIATE and bounded retries (Modules 05 and 09).
import type Database from 'better-sqlite3';

const RETRYABLE = new Set([
  'SQLITE_BUSY',
  'SQLITE_BUSY_SNAPSHOT',
  'SQLITE_BUSY_RECOVERY',
  'SQLITE_LOCKED',
]);

export interface RetryOptions {
  attempts?: number; // total attempts, default 5
  sleep?: (ms: number) => void; // injectable for tests
  onRetry?: (attempt: number, code: string) => void;
}

/** Synchronous sleep that does not spin the CPU (better-sqlite3 is synchronous anyway). */
export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run fn inside BEGIN IMMEDIATE ... COMMIT. On a retryable error the whole transaction is rolled back
 * and re-run from the beginning, never resumed: a transaction that already read data must not continue
 * after losing its lock or snapshot.
 */
export function writeTx<T>(db: Database.Database, fn: () => T, opts: RetryOptions = {}): T {
  const attempts = opts.attempts ?? 5;
  const sleep = opts.sleep ?? sleepSync;
  for (let attempt = 1; ; attempt++) {
    try {
      db.exec('BEGIN IMMEDIATE');
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      if (db.inTransaction) db.exec('ROLLBACK');
      const code = (e as { code?: string }).code ?? '';
      if (!RETRYABLE.has(code) || attempt >= attempts) throw e;
      opts.onRetry?.(attempt, code);
      sleep(Math.min(100, 2 ** attempt) + Math.floor(Math.random() * 5)); // capped exponential backoff + jitter
    }
  }
}
