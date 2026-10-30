import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface StreamEvent {
  offset: number;
  key: string;
  value: string | null; // null represents a deletion tombstone
  timestamp: number;
}

export class StreamTableEngine {
  events: StreamEvent[] = [];
  private currentOffset = 0;

  append(key: string, value: string | null, timestamp = Date.now()): StreamEvent {
    const event: StreamEvent = {
      offset: this.currentOffset++,
      key,
      value,
      timestamp,
    };
    this.events.push(event);
    return event;
  }

  // Stream -> Table: Fold stream into state table (KTable)
  materializeTable(): Map<string, string> {
    const table = new Map<string, string>();
    for (const event of this.events) {
      if (event.value === null) {
        table.delete(event.key); // Tombstone deletes row
      } else {
        table.set(event.key, event.value);
      }
    }
    return table;
  }

  // Log Compaction: Retain only the latest event for each key
  compactLog(): StreamEvent[] {
    const latestPerKey = new Map<string, StreamEvent>();

    // Scan stream and retain latest offset per key
    for (const event of this.events) {
      latestPerKey.set(event.key, event);
    }

    // In a compacted log, tombstones are kept temporarily until all consumers advance,
    // then discarded during clean-up. Here we simulate cleaned log:
    const compacted: StreamEvent[] = [];
    for (const event of latestPerKey.values()) {
      if (event.value !== null) {
        compacted.push(event);
      }
    }

    return compacted.sort((a, b) => a.offset - b.offset);
  }
}

describe('Stream-Table Duality & Log Compaction', () => {
  it('correctly folds mutation stream into a consistent state table', () => {
    const engine = new StreamTableEngine();

    engine.append('user:1', 'Alice v1');
    engine.append('user:2', 'Bob v1');
    engine.append('user:1', 'Alice v2'); // Update
    engine.append('user:3', 'Charlie v1');
    engine.append('user:2', null); // Delete tombstone

    const table = engine.materializeTable();

    assert.equal(table.size, 2);
    assert.equal(table.get('user:1'), 'Alice v2');
    assert.equal(table.has('user:2'), false); // Deleted
    assert.equal(table.get('user:3'), 'Charlie v1');
  });

  it('proves that state table rebuilt from compacted log is identical to full raw log', () => {
    const engine = new StreamTableEngine();

    // 10 mutations across 3 keys
    engine.append('k1', 'val1_a');
    engine.append('k2', 'val2_a');
    engine.append('k3', 'val3_a');
    engine.append('k1', 'val1_b');
    engine.append('k2', 'val2_b');
    engine.append('k1', 'val1_c');
    engine.append('k3', null); // k3 deleted
    engine.append('k1', 'val1_d');
    engine.append('k4', 'val4_a');
    engine.append('k2', 'val2_c');

    const rawTable = engine.materializeTable();

    // Perform log compaction
    const compactedLog = engine.compactLog();

    // Compacted log size must be much smaller than 10 events
    assert.equal(compactedLog.length, 3); // Only k1, k2, k4 remain

    // Reconstruct table from compacted log
    const tableFromCompacted = new Map<string, string>();
    for (const ev of compactedLog) {
      tableFromCompacted.set(ev.key, ev.value!);
    }

    // Proof of Duality: state table reconstructed from compacted log matches table from raw stream!
    assert.deepEqual(Object.fromEntries(rawTable), Object.fromEntries(tableFromCompacted));
  });
});
