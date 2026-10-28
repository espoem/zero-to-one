import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  await db.exec(`
    CREATE TABLE departments (
      dept_id SERIAL PRIMARY KEY,
      dept_name TEXT NOT NULL
    );

    CREATE TABLE employees (
      emp_id SERIAL PRIMARY KEY,
      dept_id INT REFERENCES departments(dept_id),
      name TEXT NOT NULL,
      salary NUMERIC(10, 2) NOT NULL,
      hire_date DATE NOT NULL
    );

    INSERT INTO departments (dept_name) VALUES ('Engineering'), ('Sales'), ('HR');

    INSERT INTO employees (dept_id, name, salary, hire_date) VALUES
      (1, 'Alice', 95000.00, '2024-01-15'),
      (1, 'Bob', 82000.00, '2025-03-20'),
      (2, 'Charlie', 65000.00, '2023-11-01'),
      (2, 'Diana', 72000.00, '2025-06-10'),
      (NULL, 'Eve', 50000.00, '2026-01-05');
  `);

  // Test 1: DISTINCT ON (PostgreSQL specific query)
  const distinctOnResult = await db.query<{ name: string; dept_id: number }>(`
    SELECT DISTINCT ON (dept_id) dept_id, name, salary
    FROM employees
    WHERE dept_id IS NOT NULL
    ORDER BY dept_id, salary DESC;
  `);
  assert.equal(distinctOnResult.rows.length, 2);
  assert.equal(distinctOnResult.rows[0]!.name, 'Alice', 'Top earner in Engineering');
  assert.equal(distinctOnResult.rows[1]!.name, 'Diana', 'Top earner in Sales');

  // Test 2: Relational Outer Joins & Aggregations
  const joinResult = await db.query<{ dept_name: string; total_salary: string }>(`
    SELECT d.dept_name, COALESCE(SUM(e.salary), 0) AS total_salary
    FROM departments d
    LEFT JOIN employees e ON d.dept_id = e.dept_id
    GROUP BY d.dept_name
    ORDER BY d.dept_name ASC;
  `);
  assert.equal(joinResult.rows.length, 3);
  assert.equal(Number(joinResult.rows.find(r => r.dept_name === 'HR')?.total_salary), 0);

  // Test 3: Upsert (INSERT ... ON CONFLICT DO UPDATE) with RETURNING
  await db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );
  `);

  const upsert1 = await db.query<{ key: string; value: string }>(`
    INSERT INTO app_settings (key, value) VALUES ('theme', 'light')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    RETURNING key, value;
  `);
  assert.equal(upsert1.rows[0]!.value, 'light');

  const upsert2 = await db.query<{ key: string; value: string }>(`
    INSERT INTO app_settings (key, value) VALUES ('theme', 'dark')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    RETURNING key, value;
  `);
  assert.equal(upsert2.rows[0]!.value, 'dark', 'Upsert should overwrite value on conflict');

  logSuccess('03-sql-querying-and-joins');
}

await run();
