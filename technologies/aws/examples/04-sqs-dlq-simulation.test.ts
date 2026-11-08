import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqsQueueSimulation } from './lib/aws-models.ts';

describe('SQS Visibility Timeout and Dead-Letter Queue Redrive', () => {
  test('Visibility timeout hides message from concurrent workers until timeout expires', () => {
    const queue = new SqsQueueSimulation({ visibilityTimeoutSeconds: 30, maxReceiveCount: 3 });
    const startTime = 1000000;

    queue.sendMessage('Process Order #101', startTime);

    // Worker 1 receives message at t = 1000000
    const batch1 = queue.receiveMessages(10, startTime);
    assert.equal(batch1.length, 1);
    assert.equal(batch1[0]?.receiveCount, 1);

    // Worker 2 attempts receive 10 seconds later (t = 1010000) -> should be hidden
    const batch2 = queue.receiveMessages(10, startTime + 10000);
    assert.equal(batch2.length, 0);

    // Worker 3 attempts receive 35 seconds later (t = 1035000) -> visibility expired, redelivered!
    const batch3 = queue.receiveMessages(10, startTime + 35000);
    assert.equal(batch3.length, 1);
    assert.equal(batch3[0]?.receiveCount, 2);
  });

  test('Message exceeding maxReceiveCount moves automatically to DLQ', () => {
    const queue = new SqsQueueSimulation({ visibilityTimeoutSeconds: 10, maxReceiveCount: 2 });
    let currentTime = 1000000;

    queue.sendMessage('Poison Pill Payload', currentTime);

    // Attempt 1: Receive (count = 1)
    const b1 = queue.receiveMessages(1, currentTime);
    assert.equal(b1.length, 1);
    assert.equal(b1[0]?.receiveCount, 1);

    // Attempt 2: After timeout, receive fails/retries (count = 2)
    currentTime += 15000;
    const b2 = queue.receiveMessages(1, currentTime);
    assert.equal(b2.length, 1);
    assert.equal(b2[0]?.receiveCount, 2);

    // Attempt 3: After timeout, receive count reaches 3 > maxReceiveCount (2) -> routes to DLQ!
    currentTime += 15000;
    const b3 = queue.receiveMessages(1, currentTime);
    assert.equal(b3.length, 0); // No visible messages in primary queue

    const lengths = queue.getQueueLength();
    assert.equal(lengths.primary, 0);
    assert.equal(lengths.dlq, 1);
  });

  test('DLQ redrive restores failed messages to primary queue with reset receive count', () => {
    const queue = new SqsQueueSimulation({ visibilityTimeoutSeconds: 10, maxReceiveCount: 1 });
    let currentTime = 1000000;

    queue.sendMessage('Retryable Event', currentTime);

    // Receive 1
    queue.receiveMessages(1, currentTime);

    // Receive 2 -> exceeding maxReceiveCount(1) -> DLQ
    currentTime += 15000;
    queue.receiveMessages(1, currentTime);

    let state = queue.getQueueLength();
    assert.equal(state.dlq, 1);
    assert.equal(state.primary, 0);

    // Redrive DLQ
    const redrivenCount = queue.redriveDlq();
    assert.equal(redrivenCount, 1);

    state = queue.getQueueLength();
    assert.equal(state.dlq, 0);
    assert.equal(state.primary, 1);

    // Can now be received again
    const redrivenBatch = queue.receiveMessages(1, Date.now());
    assert.equal(redrivenBatch.length, 1);
    assert.equal(redrivenBatch[0]?.receiveCount, 1);

    // Delete message on successful acknowledgement
    const deleted = queue.deleteMessage(redrivenBatch[0]?.receiptHandle ?? '');
    assert.equal(deleted, true);
    assert.equal(queue.getQueueLength().primary, 0);
  });
});
