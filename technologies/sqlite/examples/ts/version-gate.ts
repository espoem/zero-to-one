// Startup version gate (Module 01 § 3.2). Fail fast if the bundled engine is too old.
import type Database from 'better-sqlite3';

/** SQLITE_VERSION_NUMBER encoding: major*1_000_000 + minor*1_000 + patch. */
export function versionNumber(v: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) throw new TypeError(`not a SQLite version: ${v}`);
  return Number(m[1]) * 1_000_000 + Number(m[2]) * 1_000 + Number(m[3]);
}

/** Versions that must never run in production (withdrawn, or known data-loss bugs). */
export const DENYLIST: ReadonlyArray<{ from: string; to: string; reason: string }> = [
  { from: '3.52.0', to: '3.52.0', reason: 'withdrawn release (backward-incompatibility)' },
  {
    from: '3.7.0',
    to: '3.51.2',
    reason: 'WAL-reset race can corrupt WAL databases (fixed 3.51.3 / 3.53.0)',
  },
];

export function requireSqlite(db: Database.Database, minimum: string): string {
  const actual = db.prepare('SELECT sqlite_version()').pluck().get() as string;
  const n = versionNumber(actual);
  if (n < versionNumber(minimum)) {
    throw new Error(`SQLite ${actual} is older than required ${minimum}`);
  }
  for (const d of DENYLIST) {
    // The 3.44.6 and 3.50.7 backports carry the WAL-reset fix even though they are < 3.51.2.
    if (actual === '3.44.6' || actual === '3.50.7') continue;
    if (n >= versionNumber(d.from) && n <= versionNumber(d.to)) {
      throw new Error(`SQLite ${actual} is denied: ${d.reason}`);
    }
  }
  return actual;
}
