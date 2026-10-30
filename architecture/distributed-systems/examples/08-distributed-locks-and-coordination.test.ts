import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Fair Lock Queue (ZooKeeper Sequential Node Pattern).
 */
export class DistributedLockQueue {
  private sequenceCounter = 0;
  private readonly queue: { clientId: string; seq: number }[] = [];
  private readonly notifications = new Map<string, () => void>();

  acquire(clientId: string): { acquiredImmediately: boolean; seq: number } {
    this.sequenceCounter++;
    const seq = this.sequenceCounter;
    this.queue.push({ clientId, seq });

    if (this.queue[0]?.clientId === clientId) {
      return { acquiredImmediately: true, seq };
    }

    return { acquiredImmediately: false, seq };
  }

  // Register watch on the preceding client in the queue
  watchPredecessor(clientId: string, onWakeup: () => void): boolean {
    const idx = this.queue.findIndex((e) => e.clientId === clientId);
    if (idx <= 0) return false;
    const predecessor = this.queue[idx - 1]!;
    this.notifications.set(predecessor.clientId, onWakeup);
    return true;
  }

  release(clientId: string): boolean {
    if (this.queue.length === 0 || this.queue[0]?.clientId !== clientId) {
      return false; // Not lock holder
    }

    this.queue.shift(); // Remove current lock holder
    // Wake up ONLY the immediate successor
    const wakeup = this.notifications.get(clientId);
    if (wakeup) {
      this.notifications.delete(clientId);
      wakeup();
    }
    return true;
  }

  get currentHolder(): string | null {
    return this.queue[0]?.clientId ?? null;
  }
}

test('Module 08: Distributed Coordination & Fair Lock Queues', async (t) => {
  await t.test('Sequential lock queue guarantees FIFO fairness without thundering herds', () => {
    const lock = new DistributedLockQueue();

    // Client 1 acquires lock immediately
    const l1 = lock.acquire('client_1');
    assert.equal(l1.acquiredImmediately, true);
    assert.equal(lock.currentHolder, 'client_1');

    // Client 2 requests lock, gets queued
    const l2 = lock.acquire('client_2');
    assert.equal(l2.acquiredImmediately, false);

    // Client 3 requests lock, gets queued
    const l3 = lock.acquire('client_3');
    assert.equal(l3.acquiredImmediately, false);

    let client2Woken = false;
    let client3Woken = false;

    // Client 2 watches Client 1; Client 3 watches Client 2
    lock.watchPredecessor('client_2', () => {
      client2Woken = true;
    });
    lock.watchPredecessor('client_3', () => {
      client3Woken = true;
    });

    // Client 1 releases lock
    lock.release('client_1');

    // ONLY Client 2 should be woken up; Client 3 must stay asleep!
    assert.equal(client2Woken, true);
    assert.equal(client3Woken, false);
    assert.equal(lock.currentHolder, 'client_2');

    // Client 2 releases lock -> Now Client 3 is woken up!
    lock.release('client_2');
    assert.equal(client3Woken, true);
    assert.equal(lock.currentHolder, 'client_3');
  });
});
