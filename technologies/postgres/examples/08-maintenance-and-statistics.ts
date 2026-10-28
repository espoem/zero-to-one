import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  await db.exec(`
    CREATE TABLE auto_catalog (
      id SERIAL PRIMARY KEY,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INT NOT NULL
    );

    INSERT INTO auto_catalog (make, model, year) VALUES
      ('Audi', 'A4', 2024),
      ('Audi', 'A6', 2025),
      ('BMW', '330i', 2024),
      ('BMW', 'M5', 2026);

    -- Create Multivariate Extended Statistics
    CREATE STATISTICS stats_auto_make_model (dependencies, mcv) ON make, model FROM auto_catalog;
  `);

  // Test 1: Run VACUUM and ANALYZE
  await db.exec('VACUUM (ANALYZE) auto_catalog;');

  // Test 2: Verify extended statistics in catalog
  const statsCatalog = await db.query<{ stxname: string }>(`
    SELECT stxname FROM pg_statistic_ext WHERE stxname = 'stats_auto_make_model';
  `);
  assert.equal(statsCatalog.rows.length, 1);
  assert.equal(statsCatalog.rows[0]!.stxname, 'stats_auto_make_model');

  // Test 3: Catalog verification of dead tuple tracking
  const statTables = await db.query<{ relname: string }>(`
    SELECT relname FROM pg_stat_user_tables WHERE relname = 'auto_catalog';
  `);
  assert.equal(statTables.rows.length, 1);

  logSuccess('08-maintenance-and-statistics');
}

await run();
