// Single-writer queue with group commit (Module 09 § 4).
// All writes in the process go through one connection. Jobs that arrive in the same tick are
// committed together in one BEGIN IMMEDIATE transaction; each job runs in its own SAVEPOINT,
// so one failing job is rolled back alone.
import type Database from 'better-sqlite3';

type Job<T> = {
  fn: (db: Database.Database) => T;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};

export class WriteQueue {
  #db: Database.Database;
  #pending: Job<unknown>[] = [];
  #scheduled = false;
  transactions = 0;

  constructor(db: Database.Database) {
    this.#db = db;
  }

  enqueue<T>(fn: (db: Database.Database) => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#pending.push({ fn, resolve, reject } as Job<unknown>);
      if (!this.#scheduled) {
        this.#scheduled = true;
        setImmediate(() => this.#flush()); // collect everything enqueued in this tick
      }
    });
  }

  #flush(): void {
    this.#scheduled = false;
    const batch = this.#pending.splice(0);
    const settled: Array<() => void> = [];
    const db = this.#db;
    try {
      db.exec('BEGIN IMMEDIATE');
      for (const job of batch) {
        db.exec('SAVEPOINT job');
        try {
          const value = job.fn(db);
          db.exec('RELEASE job');
          settled.push(() => job.resolve(value));
        } catch (e) {
          db.exec('ROLLBACK TO job; RELEASE job');
          settled.push(() => job.reject(e));
        }
      }
      db.exec('COMMIT');
      this.transactions++;
      settled.forEach((s) => s()); // resolve only after the commit is durable
    } catch (e) {
      if (db.inTransaction) db.exec('ROLLBACK');
      batch.forEach((job) => job.reject(e));
    }
  }
}
