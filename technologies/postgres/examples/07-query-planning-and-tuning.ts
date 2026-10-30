import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  await db.exec(`
    CREATE TABLE car_inventory (
      id SERIAL PRIMARY KEY,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INT NOT NULL,
      price NUMERIC(10,2) NOT NULL
    );

    INSERT INTO car_inventory (make, model, year, price)
    SELECT 
      CASE WHEN i % 2 = 0 THEN 'Audi' ELSE 'BMW' END,
      CASE WHEN i % 2 = 0 THEN 'A4' ELSE '330i' END,
      2020 + (i % 6),
      30000 + (i * 10)
    FROM generate_series(1, 200) AS i;
  `);

  // Test 1: EXPLAIN plan generation & cost parameter calibration
  await db.exec("SET random_page_cost = 1.1;");
  const costSetting = await db.query<{ random_page_cost: string }>("SHOW random_page_cost;");
  assert.equal(costSetting.rows[0]!.random_page_cost, '1.1');

  const explainResult = await db.query<{ 'QUERY PLAN': string }>(
    "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM car_inventory WHERE make = 'Audi' AND model = 'A4';"
  );
  assert.ok(explainResult.rows.length > 0);
  const planText = explainResult.rows.map(r => r['QUERY PLAN']).join('\n');
  assert.match(planText, /Scan/i);

  // Test 2: Multivariate Extended Statistics on Correlated Columns
  await db.exec(`
    CREATE STATISTICS stats_cars_correlated (dependencies, mcv) 
    ON make, model FROM car_inventory;

    ANALYZE car_inventory;
  `);

  const statCheck = await db.query<{ stxname: string }>(
    "SELECT stxname FROM pg_statistic_ext WHERE stxname = 'stats_cars_correlated';"
  );
  assert.equal(statCheck.rows.length, 1);

  logSuccess('07-query-planning-and-tuning');
}

await run();
