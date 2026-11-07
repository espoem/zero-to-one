// Background checkpointing and WAL health metrics (Module 06 § 6.4).
import { statSync } from 'node:fs';
import type Database from 'better-sqlite3';

export type CheckpointMode = 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE';
export interface CheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

export function checkpoint(
  db: Database.Database,
  mode: CheckpointMode = 'PASSIVE',
): CheckpointResult {
  const [row] = db.pragma(`wal_checkpoint(${mode})`) as CheckpointResult[];
  return row!;
}

/** WAL health: frames not yet copied, and the size of the -wal file on disk. */
export function walHealth(db: Database.Database): {
  pending: number;
  walBytes: number;
  starved: boolean;
} {
  const r = checkpoint(db, 'PASSIVE');
  let walBytes = 0;
  try {
    walBytes = statSync(`${db.name}-wal`).size;
  } catch {
    /* no WAL file yet */
  }
  // "Starved": a PASSIVE checkpoint could not copy everything, so some reader pins old frames.
  return {
    pending: r.log - r.checkpointed,
    walBytes,
    starved: r.log > 0 && r.checkpointed < r.log,
  };
}

/**
 * Escalating policy: PASSIVE every tick; if the WAL keeps growing past `maxBytes`,
 * try TRUNCATE (which waits for a reader gap via the busy handler) to reset it.
 */
export function tick(db: Database.Database, maxBytes: number): 'ok' | 'truncated' | 'starved' {
  const h = walHealth(db);
  if (h.walBytes <= maxBytes) return 'ok';
  const r = checkpoint(db, 'TRUNCATE');
  return r.busy === 0 ? 'truncated' : 'starved';
}
