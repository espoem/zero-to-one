import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudQueue } from './lib/cloud-models.ts';

describe('Module 09: Messaging, DLQs & Idempotency', () => {
  it('routes poison messages to Dead Letter Queue after maxReceiveCount is exceeded', () => {
    const queue = new CloudQueue(1000, 3); // 1000ms visibility, max 3 attempts
    const idempotencyKey = 'order-create-evt-99182';

    queue.enqueue('{"orderId": "99182", "amount": 49.99}', idempotencyKey, 100);

    // Attempt 1: Receive but worker crashes without acking
    const m1 = queue.receive(100);
    assert.ok(m1);
    assert.equal(m1.receiveCount, 1);

    // Attempt 2: After visibility timeout expires at t=1101
    const m2 = queue.receive(1105);
    assert.ok(m2);
    assert.equal(m2.receiveCount, 2);

    // Attempt 3: Worker crashes again, visibility expires at t=2106
    const m3 = queue.receive(2110);
    assert.ok(m3);
    assert.equal(m3.receiveCount, 3);

    // Attempt 4: Exceeds maxReceiveCount (3), routed to DLQ!
    const m4 = queue.receive(3120);
    assert.strictEqual(m4, null); // Main queue has no visible messages
    assert.equal(queue.deadLetterQueue.length, 1);
    assert.equal(queue.deadLetterQueue[0]!.idempotencyKey, idempotencyKey);
  });

  it('proves idempotent consumer discards duplicated at-least-once deliveries', () => {
    const queue = new CloudQueue(5000, 3);
    const key = 'payment-capture-txn-4421';

    queue.enqueue('{"txnId": "4421", "amount": 100.00}', key, 0);

    const msg = queue.receive(0)!;
    assert.ok(msg);

    // First processing
    const firstAttempt = queue.acknowledge(msg.id, msg.idempotencyKey);
    assert.strictEqual(firstAttempt.processed, true);
    assert.strictEqual(firstAttempt.duplicate, false);

    // Second processing of same idempotency key (duplicate redelivery)
    const secondAttempt = queue.acknowledge(msg.id, msg.idempotencyKey);
    assert.strictEqual(secondAttempt.processed, false);
    assert.strictEqual(secondAttempt.duplicate, true);
  });
});
