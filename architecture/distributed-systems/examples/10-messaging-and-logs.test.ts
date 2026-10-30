import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Log partition simulation.
 */
export interface MessageRecord {
  offset: number;
  key: string;
  payload: string;
}

export class LogPartition {
  readonly records: MessageRecord[] = [];
  highWatermark = 0; // HW

  append(key: string, payload: string): number {
    const offset = this.records.length;
    this.records.push({ offset, key, payload });
    return offset;
  }

  advanceHighWatermark(newHW: number): void {
    this.highWatermark = Math.min(newHW, this.records.length);
  }

  // Consumer only permitted to read up to High Watermark
  readConsumer(fromOffset: number): MessageRecord[] {
    const safeEnd = this.highWatermark;
    if (fromOffset >= safeEnd) return [];
    return this.records.slice(fromOffset, safeEnd);
  }

  get LEO(): number {
    return this.records.length;
  }
}

/**
 * Murmur-style simple hash for partition key mapping.
 */
export function hashPartitionKey(key: string, numPartitions: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % numPartitions;
}

test('Module 10: Distributed Logs, Messaging & Partitioning', async (t) => {
  await t.test('High Watermark isolates uncommitted entries from consumers', () => {
    const partition = new LogPartition();

    // Producer appends records 0, 1, 2, 3
    partition.append('k1', 'msg0');
    partition.append('k1', 'msg1');
    partition.append('k1', 'msg2');
    partition.append('k1', 'msg3');

    assert.equal(partition.LEO, 4);

    // High watermark is currently at offset 2 (only msg0 and msg1 replicated to ISR)
    partition.advanceHighWatermark(2);

    const consumed = partition.readConsumer(0);
    // Consumer can only see 2 records!
    assert.equal(consumed.length, 2);
    assert.equal(consumed[0]!.payload, 'msg0');
    assert.equal(consumed[1]!.payload, 'msg1');

    // Once followers catch up, HW advances to 4
    partition.advanceHighWatermark(4);
    const newConsumed = partition.readConsumer(2);
    assert.equal(newConsumed.length, 2);
    assert.equal(newConsumed[0]!.payload, 'msg2');
    assert.equal(newConsumed[1]!.payload, 'msg3');
  });

  await t.test('Increasing topic partition count breaks per-key routing and ordering', () => {
    const userKey = 'user_order_99882';

    // Topic originally has 4 partitions
    const originalPartition = hashPartitionKey(userKey, 4);

    // Operator resizes topic from 4 to 6 partitions
    const newPartition = hashPartitionKey(userKey, 6);

    // Proves that key hash mapping shifts, sending subsequent messages for the same key
    // to a different partition, breaking sequential consumer ordering!
    assert.notEqual(originalPartition, newPartition);
  });
});
