import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Two Generals Problem simulation demonstrating that consensus over an
 * unreliable channel requires infinite acknowledgments.
 */
export function simulateTwoGenerals(
  maxRounds: number,
  packetDropRate: number,
  randomFn = Math.random
): { agreed: boolean; roundsUsed: number; totalAcks: number } {
  let g1Confirmed = false;
  let g2Confirmed = false;
  let rounds = 0;
  let totalAcks = 0;

  for (let r = 1; r <= maxRounds; r++) {
    rounds = r;
    // G1 sends proposal
    if (randomFn() >= packetDropRate) {
      // G2 receives, sends ACK
      totalAcks++;
      if (randomFn() >= packetDropRate) {
        // G1 receives ACK
        g1Confirmed = true;
        // G1 must ACK the ACK so G2 knows G1 knows
        if (randomFn() >= packetDropRate) {
          g2Confirmed = true;
          break; // Both have common knowledge of degree 2
        }
      }
    }
  }

  return { agreed: g1Confirmed && g2Confirmed, roundsUsed: rounds, totalAcks };
}

/**
 * Gilbert-Lynch CAP Trade-off simulation:
 * When network partition occurs:
 * - CP Mode: Rejects writes on minority partitions to preserve linearizability.
 * - AP Mode: Accepts writes on all partitions, violating linearizability.
 */
export class PartitionedKVStore {
  private readonly nodes: Map<string, { val: number; partition: number }> = new Map();

  constructor(nodeIds: string[]) {
    for (const id of nodeIds) {
      this.nodes.set(id, { val: 0, partition: 1 });
    }
  }

  setPartition(nodeId: string, partitionId: number): void {
    const node = this.nodes.get(nodeId);
    if (node) node.partition = partitionId;
  }

  writeCP(nodeId: string, val: number): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Count nodes in this partition
    let countInPartition = 0;
    for (const n of this.nodes.values()) {
      if (n.partition === node.partition) countInPartition++;
    }

    const majority = Math.floor(this.nodes.size / 2) + 1;
    if (countInPartition >= majority) {
      // Majority partition: update all in partition
      for (const n of this.nodes.values()) {
        if (n.partition === node.partition) n.val = val;
      }
      return true;
    }
    // Minority partition: reject write to preserve consistency!
    return false;
  }

  writeAP(nodeId: string, val: number): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    // AP: Accept write regardless of partition
    for (const n of this.nodes.values()) {
      if (n.partition === node.partition) n.val = val;
    }
    return true; // Always available!
  }

  read(nodeId: string): number {
    return this.nodes.get(nodeId)?.val ?? 0;
  }
}

test('Module 01: System Models, Impossibility & CAP', async (t) => {
  await t.test('Two Generals simulation: 100% lossy channel prevents common knowledge', () => {
    // With 100% drop rate, consensus is impossible
    const result = simulateTwoGenerals(10, 1.0);
    assert.equal(result.agreed, false);
    assert.equal(result.totalAcks, 0);
  });

  await t.test('CAP Theorem: CP mode rejects minority partition writes to preserve consistency', () => {
    const store = new PartitionedKVStore(['A', 'B', 'C']); // 3 nodes, majority is 2
    // Normal operation: Write succeeds
    assert.equal(store.writeCP('A', 100), true);
    assert.equal(store.read('A'), 100);
    assert.equal(store.read('B'), 100);

    // Network partition: A is isolated in Partition 2, while B and C are in Partition 1
    store.setPartition('A', 2);
    store.setPartition('B', 1);
    store.setPartition('C', 1);

    // CP write to isolated minority node A MUST be rejected
    assert.equal(store.writeCP('A', 200), false);
    assert.equal(store.read('A'), 100); // Unaltered

    // CP write to majority node B succeeds
    assert.equal(store.writeCP('B', 300), true);
    assert.equal(store.read('B'), 300);
    assert.equal(store.read('C'), 300);
  });

  await t.test('CAP Theorem: AP mode accepts writes on partition, creating divergent states', () => {
    const store = new PartitionedKVStore(['A', 'B']); // 2 nodes
    // Partition: A in partition 1, B in partition 2
    store.setPartition('A', 1);
    store.setPartition('B', 2);

    // AP accepts writes on both sides
    assert.equal(store.writeAP('A', 111), true);
    assert.equal(store.writeAP('B', 222), true);

    // State diverges: reading from A and B gives conflicting values
    assert.equal(store.read('A'), 111);
    assert.equal(store.read('B'), 222);
    assert.notEqual(store.read('A'), store.read('B'));
  });
});
