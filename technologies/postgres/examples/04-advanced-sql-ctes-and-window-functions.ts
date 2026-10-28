import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Recursive CTE Hierarchy
  await db.exec(`
    CREATE TABLE org (
      id INT PRIMARY KEY,
      manager_id INT REFERENCES org(id),
      name TEXT NOT NULL
    );

    INSERT INTO org VALUES 
      (1, NULL, 'CEO'),
      (2, 1, 'VP Tech'),
      (3, 1, 'VP Sales'),
      (4, 2, 'Lead Dev'),
      (5, 4, 'Junior Dev');
  `);

  const recurseResult = await db.query<{ name: string; depth: number }>(`
    WITH RECURSIVE org_tree AS (
      SELECT id, manager_id, name, 1 AS depth
      FROM org
      WHERE manager_id IS NULL
      UNION ALL
      SELECT o.id, o.manager_id, o.name, t.depth + 1
      FROM org o
      INNER JOIN org_tree t ON o.manager_id = t.id
    )
    SELECT name, depth FROM org_tree ORDER BY depth ASC, name ASC;
  `);

  assert.equal(recurseResult.rows.length, 5);
  assert.equal(recurseResult.rows[0]!.name, 'CEO');
  assert.equal(recurseResult.rows[0]!.depth, 1);
  assert.equal(recurseResult.rows[4]!.name, 'Junior Dev');
  assert.equal(recurseResult.rows[4]!.depth, 4);

  // Test 2: generate_series and Window Functions (Running Total & LAG)
  const windowResult = await db.query<{ day_num: number; running_total: number; prev_val: number | null }>(`
    WITH sales_data AS (
      SELECT s AS day_num, s * 100 AS daily_sales
      FROM generate_series(1, 5) AS s
    )
    SELECT 
      day_num,
      SUM(daily_sales) OVER (ORDER BY day_num ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
      LAG(daily_sales) OVER (ORDER BY day_num) AS prev_val
    FROM sales_data;
  `);

  assert.equal(windowResult.rows.length, 5);
  assert.equal(Number(windowResult.rows[0]!.running_total), 100);
  assert.equal(Number(windowResult.rows[4]!.running_total), 1500, 'Sum of 100+200+300+400+500 = 1500');
  assert.equal(windowResult.rows[0]!.prev_val, null);
  assert.equal(Number(windowResult.rows[1]!.prev_val), 100);

  logSuccess('04-advanced-sql-ctes-and-window-functions');
}

await run();
