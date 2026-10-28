import assert from 'node:assert/strict';
import { createTestDatabase, logSuccess } from './utils/db.ts';

async function run(): Promise<void> {
  const db = await createTestDatabase();

  // Test 1: Relational Schema DDL with Exact Numeric, Constraints & Checks
  await db.exec(`
    CREATE TABLE customers (
      customer_id SERIAL PRIMARY KEY,
      company_name VARCHAR(120) NOT NULL,
      tax_id VARCHAR(32) NOT NULL UNIQUE,
      balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );

    CREATE TABLE orders (
      order_id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0.00)
    );
  `);

  // Test 2: Insert Parent & Child Tuples
  await db.exec(`
    INSERT INTO customers (company_name, tax_id, balance) 
    VALUES ('Acme Corp', 'CZ12345678', 500.00);

    INSERT INTO orders (customer_id, total_amount)
    VALUES (1, 150.50);
  `);

  const orderCheck = await db.query<{ total_amount: string }>('SELECT total_amount FROM orders WHERE customer_id = 1;');
  assert.equal(Number(orderCheck.rows[0]!.total_amount), 150.50);

  // Test 3: Referential Integrity & Cascade Deletion
  await db.query('DELETE FROM customers WHERE customer_id = 1;');
  const ordersAfterDelete = await db.query('SELECT * FROM orders WHERE customer_id = 1;');
  assert.equal(ordersAfterDelete.rows.length, 0, 'Child orders should be deleted via ON DELETE CASCADE');

  // Test 4: Generated Columns Evaluation
  await db.exec(`
    CREATE TABLE line_items (
      item_id SERIAL PRIMARY KEY,
      quantity INT NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      line_total NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
    );

    INSERT INTO line_items (quantity, unit_price) VALUES (4, 25.00);
  `);

  const genResult = await db.query<{ line_total: string }>('SELECT line_total FROM line_items WHERE item_id = 1;');
  assert.equal(Number(genResult.rows[0]!.line_total), 100.00, 'Generated column must evaluate accurately');

  logSuccess('02-relational-modeling-and-constraints');
}

await run();
