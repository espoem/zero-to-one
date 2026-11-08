import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEventPattern,
  type EventBridgeEvent,
  type EventPattern,
} from './lib/aws-models.ts';

describe('EventBridge Event Pattern Evaluation Engine', () => {
  const baseEvent: EventBridgeEvent = {
    id: 'evt-1111-2222-3333',
    source: 'com.acme.ecommerce',
    'detail-type': 'OrderPlaced',
    account: '123456789012',
    time: '2026-11-08T18:00:00Z',
    region: 'eu-central-1',
    resources: ['arn:aws:custom:orders/order-999'],
    detail: {
      orderId: 'order-999',
      status: 'COMPLETED',
      category: 'electronics',
      totalAmount: 350.5,
      itemsCount: 3,
    },
  };

  test('Exact match on source and detail-type', () => {
    const pattern: EventPattern = {
      source: ['com.acme.ecommerce'],
      'detail-type': ['OrderPlaced', 'OrderUpdated'],
    };

    assert.equal(evaluateEventPattern(pattern, baseEvent), true);

    const nonMatchingPattern: EventPattern = {
      source: ['com.acme.billing'],
    };
    assert.equal(evaluateEventPattern(nonMatchingPattern, baseEvent), false);
  });

  test('Prefix and numeric range matching in detail payload', () => {
    const pattern: EventPattern = {
      source: ['com.acme.ecommerce'],
      detail: {
        orderId: [{ prefix: 'order-' }],
        totalAmount: [{ numeric: ['>', 100, '<=', 500] }],
        status: ['COMPLETED'],
      },
    };

    assert.equal(evaluateEventPattern(pattern, baseEvent), true);

    // Fail if numeric condition is breached
    const failingNumericPattern: EventPattern = {
      detail: {
        totalAmount: [{ numeric: ['>', 500] }],
      },
    };
    assert.equal(evaluateEventPattern(failingNumericPattern, baseEvent), false);
  });

  test('Anything-but and exists operators', () => {
    const pattern: EventPattern = {
      detail: {
        status: [{ 'anything-but': ['CANCELLED', 'REJECTED'] }],
        itemsCount: [{ exists: true }],
        discountCode: [{ exists: false }],
      },
    };

    assert.equal(evaluateEventPattern(pattern, baseEvent), true);

    // If status matches excluded list, pattern evaluation must fail
    const rejectedStatusPattern: EventPattern = {
      detail: {
        status: [{ 'anything-but': ['COMPLETED'] }],
      },
    };
    assert.equal(evaluateEventPattern(rejectedStatusPattern, baseEvent), false);
  });
});
