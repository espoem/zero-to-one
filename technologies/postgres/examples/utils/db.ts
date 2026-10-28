import { PGlite } from '@electric-sql/pglite';

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  return db;
}

export async function runSql(db: PGlite, sql: string): Promise<void> {
  await db.exec(sql);
}

export function logSuccess(suiteName: string): void {
  console.log(`[PASS] ${suiteName}`);
}
