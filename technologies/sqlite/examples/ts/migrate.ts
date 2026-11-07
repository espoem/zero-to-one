// Schema migrations keyed on PRAGMA user_version (Module 10 § 6).
import type Database from 'better-sqlite3';

export type Migration = (db: Database.Database) => void;

/**
 * Apply migrations[userVersion..] in order. Each migration and its version bump commit together,
 * so a failure leaves the database at the last fully applied version.
 * Invariant: after k successful iterations, user_version = start + k and the schema matches.
 */
export function migrate(db: Database.Database, migrations: readonly Migration[]): number {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > migrations.length) {
    throw new Error(
      `database is at version ${current}, newer than this code (${migrations.length})`,
    );
  }
  for (let v = current; v < migrations.length; v++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      // Re-check under the write lock: another process may have migrated meanwhile.
      if ((db.pragma('user_version', { simple: true }) as number) !== v) {
        db.exec('ROLLBACK');
        continue;
      }
      migrations[v]!(db);
      db.pragma(`user_version = ${v + 1}`);
      const fk = db.pragma('foreign_key_check') as unknown[];
      if (fk.length > 0)
        throw new Error(`migration ${v + 1} left ${fk.length} foreign key violations`);
      db.exec('COMMIT');
    } catch (e) {
      if (db.inTransaction) db.exec('ROLLBACK');
      throw e;
    }
  }
  return db.pragma('user_version', { simple: true }) as number;
}
