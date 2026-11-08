import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { R2BucketSimulator, QueuesEngine, WorkflowInstance } from './lib/edge-models.ts';
import type { QueueMessage } from './lib/edge-models.ts';

describe('Module 08 & 09: R2 Multipart, Queues DLQ & Workflows Replay Determinism', () => {
  it('enforces strictly ascending part numbers and etag verification in R2 multipart uploads', () => {
    const bucket = new R2BucketSimulator();
    const { uploadId } = bucket.createMultipartUpload('backups/db.tar.gz');

    const part1Data = new Uint8Array([1, 2, 3]);
    const part2Data = new Uint8Array([4, 5, 6]);

    const part1 = bucket.uploadPart(uploadId, 1, part1Data);
    const part2 = bucket.uploadPart(uploadId, 2, part2Data);

    // Reject out-of-order parts
    assert.throws(
      () => {
        bucket.completeMultipartUpload(uploadId, [
          { partNumber: 2, etag: part2.etag },
          { partNumber: 1, etag: part1.etag },
        ]);
      },
      { message: 'Parts must be listed in strictly ascending order' },
    );

    // Complete successfully in order
    const completed = bucket.completeMultipartUpload(uploadId, [
      { partNumber: 1, etag: part1.etag },
      { partNumber: 2, etag: part2.etag },
    ]);

    assert.equal(completed.key, 'backups/db.tar.gz');
    assert.equal(completed.size, 6);

    const retrieved = bucket.get('backups/db.tar.gz');
    assert.deepEqual(Array.from(retrieved!.body), [1, 2, 3, 4, 5, 6]);
  });

  it('routes failed messages to Dead Letter Queue after exhausting max retries in Queues', async () => {
    const engine = new QueuesEngine<string>(2); // Max 2 retries (3 total attempts)

    const messages: QueueMessage<string>[] = [
      { id: 'msg_ok', body: 'payment_processed', attempts: 1 },
      { id: 'msg_fail', body: 'bad_payload', attempts: 1 },
    ];

    await engine.processBatch(messages, async (msg, ctrl) => {
      if (msg.id === 'msg_ok') {
        ctrl.ack();
      } else {
        ctrl.retry();
      }
    });

    assert.equal(engine.ackedMessages.length, 1);
    assert.equal(engine.ackedMessages[0], 'msg_ok');
    assert.equal(engine.deadLetterQueue.length, 0); // Not exhausted yet (attempts = 2)

    // Second failure
    const retryMsg = messages[1];
    assert(retryMsg !== undefined);
    await engine.processBatch([retryMsg], async (_msg, ctrl) => {
      ctrl.retry();
    });
    assert.equal(engine.deadLetterQueue.length, 1); // Now attempts = 3 > maxRetries(2) -> DLQ!
    assert.equal(engine.deadLetterQueue[0]?.id, 'msg_fail');
  });

  it('replays Workflows skipping completed steps and preserving determinism', async () => {
    const workflow = new WorkflowInstance();

    let stepOneExecutionCount = 0;
    let stepTwoExecutionCount = 0;

    const runExecution = async () => {
      const step1Result = await workflow.runStep('fetch-user', async () => {
        stepOneExecutionCount++;
        return { userId: 42, role: 'admin' };
      });

      const step2Result = await workflow.runStep('send-email', async () => {
        stepTwoExecutionCount++;
        return `Sent to user ${step1Result.userId}`;
      });

      return step2Result;
    };

    // First attempt runs step 1
    const res1 = await workflow.runStep('fetch-user', async () => {
      stepOneExecutionCount++;
      return { userId: 42, role: 'admin' };
    });
    assert.equal(res1.userId, 42);
    assert.equal(stepOneExecutionCount, 1);

    // Simulate worker crash / hibernation
    workflow.simulateCrashAndRestart();

    // Replay execution: step 1 is skipped (memoized), step 2 executes
    const finalResult = await runExecution();
    assert.equal(finalResult, 'Sent to user 42');
    assert.equal(stepOneExecutionCount, 1); // Still 1! Not re-executed!
    assert.equal(stepTwoExecutionCount, 1);
  });
});
