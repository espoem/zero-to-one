import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PubSubSubscriptionSimulator } from './lib/gcp-models.ts';

describe('Cloud Pub/Sub Messaging & Stream Processing Engine', () => {
  it('Ordering Keys: Delivers messages sequentially within the same ordering key', () => {
    // Subscription with ordering keys enabled
    const sub = new PubSubSubscriptionSimulator(true, 10);

    // Publish 3 messages for customer-A and 2 messages for customer-B
    sub.publish({ id: 'msg-1', data: 'Order Created', orderingKey: 'cust-A', publishTimeMs: 1000 });
    sub.publish({
      id: 'msg-2',
      data: 'Payment Authorized',
      orderingKey: 'cust-A',
      publishTimeMs: 1010,
    });
    sub.publish({ id: 'msg-3', data: 'Order Shipped', orderingKey: 'cust-A', publishTimeMs: 1020 });
    sub.publish({ id: 'msg-4', data: 'Cart Created', orderingKey: 'cust-B', publishTimeMs: 1005 });
    sub.publish({ id: 'msg-5', data: 'Cart Updated', orderingKey: 'cust-B', publishTimeMs: 1015 });

    // Initial pull delivers only the FIRST message for each active ordering key
    const firstBatch = sub.pull(2000);
    assert.equal(firstBatch.length, 2);
    const deliveredIds = firstBatch.map((m) => m.id);
    assert.deepEqual(deliveredIds, ['msg-1', 'msg-4']);

    // Acknowledge msg-1 for customer-A
    sub.acknowledge('msg-1');

    // Next pull delivers the SECOND message for customer-A, while customer-B is still awaiting ack of msg-4
    const secondBatch = sub.pull(2010);
    assert.equal(secondBatch.length, 1);
    assert.equal(secondBatch[0]?.id, 'msg-2');
  });

  it('Dead-Letter Topic Routing: Routes poisoned message to DLQ after exceeding maxDeliveryAttempts', () => {
    const maxAttempts = 3;
    const sub = new PubSubSubscriptionSimulator(false, 10, maxAttempts);

    sub.publish({ id: 'poison-pill', data: 'Corrupted JSON', publishTimeMs: 1000 });
    assert.equal(sub.getPendingCount(), 1);
    assert.equal(sub.getDlqCount(), 0);

    // Attempt 1: Pull and simulate processing failure (NACK)
    const pull1 = sub.pull(2000);
    assert.equal(pull1[0]?.deliveryAttempts, 1);
    let nackRes = sub.handleNackOrTimeout('poison-pill');
    assert.equal(nackRes.movedToDlq, false);

    // Attempt 2: Pull again
    const pull2 = sub.pull(3000);
    assert.equal(pull2[0]?.deliveryAttempts, 2);
    nackRes = sub.handleNackOrTimeout('poison-pill');
    assert.equal(nackRes.movedToDlq, false);

    // Attempt 3: Pull again (reaches maxAttempts = 3)
    const pull3 = sub.pull(4000);
    assert.equal(pull3[0]?.deliveryAttempts, 3);
    nackRes = sub.handleNackOrTimeout('poison-pill');
    assert.equal(nackRes.movedToDlq, true);

    // Message moved to DLQ and evicted from primary subscription
    assert.equal(sub.getPendingCount(), 0);
    assert.equal(sub.getDlqCount(), 1);
  });
});
