import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DynamoSingleTableStore, type DynamoItem } from './lib/aws-models.ts';

describe('DynamoDB Single-Table Key Architecture', () => {
  test('Query orders for a customer using composite key prefix matching', () => {
    const store = new DynamoSingleTableStore();

    // Populate customer profile and orders
    const customerProfile: DynamoItem = {
      PK: 'CUST#1001',
      SK: 'PROFILE',
      entityType: 'CUSTOMER',
      name: 'Acme Corp',
      tier: 'Enterprise',
    };

    const order1: DynamoItem = {
      PK: 'CUST#1001',
      SK: 'ORD#2026-11-01#001',
      GSI1PK: 'STATUS#PENDING',
      GSI1SK: '2026-11-01#ORD#001',
      entityType: 'ORDER',
      amountUsd: 4500,
    };

    const order2: DynamoItem = {
      PK: 'CUST#1001',
      SK: 'ORD#2026-11-05#002',
      GSI1PK: 'STATUS#COMPLETED',
      GSI1SK: '2026-11-05#ORD#002',
      entityType: 'ORDER',
      amountUsd: 12000,
    };

    const unrelatedCustomerOrder: DynamoItem = {
      PK: 'CUST#2002',
      SK: 'ORD#2026-11-02#003',
      GSI1PK: 'STATUS#PENDING',
      GSI1SK: '2026-11-02#ORD#003',
      entityType: 'ORDER',
      amountUsd: 850,
    };

    store.putItem(customerProfile);
    store.putItem(order1);
    store.putItem(order2);
    store.putItem(unrelatedCustomerOrder);

    // Query all orders for CUST#1001 without retrieving the customer profile
    const queryResult = store.query({
      tableName: 'EnterpriseTable',
      partitionKey: { attribute: 'PK', value: 'CUST#1001' },
      sortKeyCondition: {
        attribute: 'SK',
        operator: 'begins_with',
        value: 'ORD#',
      },
    });

    assert.equal(queryResult.valid, true);
    assert.equal(queryResult.matchedItems.length, 2);
    assert.equal(queryResult.matchedItems[0]?.SK, 'ORD#2026-11-01#001');
    assert.equal(queryResult.matchedItems[1]?.SK, 'ORD#2026-11-05#002');
    assert.ok(queryResult.consumedRcuEstimate >= 1);
  });

  test('Query inverted Global Secondary Index (GSI1) across heterogeneous entities', () => {
    const store = new DynamoSingleTableStore();

    store.putItem({
      PK: 'CUST#1001',
      SK: 'ORD#001',
      GSI1PK: 'STATUS#PENDING',
      GSI1SK: '2026-11-01#ORD#001',
      entityType: 'ORDER',
      amount: 500,
    });

    store.putItem({
      PK: 'CUST#2002',
      SK: 'ORD#002',
      GSI1PK: 'STATUS#PENDING',
      GSI1SK: '2026-11-02#ORD#002',
      entityType: 'ORDER',
      amount: 1200,
    });

    store.putItem({
      PK: 'CUST#3003',
      SK: 'ORD#003',
      GSI1PK: 'STATUS#SHIPPED',
      GSI1SK: '2026-11-03#ORD#003',
      entityType: 'ORDER',
      amount: 750,
    });

    // Query all PENDING orders across all customers via GSI1
    const gsiResult = store.query({
      tableName: 'EnterpriseTable',
      indexName: 'GSI1',
      partitionKey: { attribute: 'GSI1PK', value: 'STATUS#PENDING' },
    });

    assert.equal(gsiResult.valid, true);
    assert.equal(gsiResult.matchedItems.length, 2);
    assert.equal(gsiResult.matchedItems[0]?.PK, 'CUST#1001');
    assert.equal(gsiResult.matchedItems[1]?.PK, 'CUST#2002');
  });

  test('Validates sort key between operator requires both boundary bounds', () => {
    const store = new DynamoSingleTableStore();

    const invalidQuery = store.query({
      tableName: 'EnterpriseTable',
      partitionKey: { attribute: 'PK', value: 'CUST#1001' },
      sortKeyCondition: {
        attribute: 'SK',
        operator: 'between',
        value: 'ORD#2026-11-01',
        // secondValue intentionally omitted
      },
    });

    assert.equal(invalidQuery.valid, false);
    assert.ok(
      invalidQuery.errors[0]?.includes("'between' sort key condition requires secondValue"),
    );
  });
});
