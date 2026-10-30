import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface RecordVersion {
  value: string;
  version: number;
}

export class ReplicaNode {
  readonly id: number;
  storage = new Map<string, RecordVersion>();

  constructor(id: number) {
    this.id = id;
  }

  write(key: string, value: string, version: number): boolean {
    const existing = this.storage.get(key);
    if (!existing || version >= existing.version) {
      this.storage.set(key, { value, version });
      return true;
    }
    return false;
  }

  read(key: string): RecordVersion | null {
    return this.storage.get(key) ?? null;
  }
}

export class QuorumCluster {
  readonly nodes: ReplicaNode[];
  readonly n: number;

  constructor(n = 5) {
    this.n = n;
    this.nodes = Array.from({ length: n }, (_, i) => new ReplicaNode(i));
  }

  writeQuorum(key: string, value: string, version: number, w: number, targetNodes?: number[]): boolean {
    const targets = targetNodes ? targetNodes.map((id) => this.nodes[id]!) : this.nodes;
    let acks = 0;

    for (const node of targets) {
      if (node.write(key, value, version)) {
        acks++;
        if (acks >= w) {
          return true; // Quorum satisfied
        }
      }
    }
    return acks >= w;
  }

  readQuorum(key: string, r: number, targetNodes?: number[], enableReadRepair = true): RecordVersion | null {
    const targets = targetNodes ? targetNodes.map((id) => this.nodes[id]!) : this.nodes;
    const responses: { node: ReplicaNode; record: RecordVersion | null }[] = [];

    for (const node of targets) {
      responses.push({ node, record: node.read(key) });
      if (responses.length >= r) break;
    }

    if (responses.length < r) {
      throw new Error(`Read quorum failed: only ${responses.length} nodes available, required ${r}`);
    }

    // Determine highest version
    let highest: RecordVersion | null = null;
    for (const resp of responses) {
      if (resp.record !== null) {
        if (!highest || resp.record.version > highest.version) {
          highest = resp.record;
        }
      }
    }

    // Asynchronous Read Repair for nodes that returned stale versions
    if (enableReadRepair && highest !== null) {
      for (const resp of responses) {
        if (!resp.record || resp.record.version < highest.version) {
          resp.node.write(key, highest.value, highest.version);
        }
      }
    }

    return highest;
  }
}

describe('Replication Quorums (W + R > N) & Read Repair', () => {
  it('guarantees observing the latest write when W + R > N', () => {
    // N = 5, W = 3, R = 3 -> W + R = 6 > 5 (Strict Quorum Overlap)
    const cluster = new QuorumCluster(5);

    // Initial write version 1 across all nodes
    cluster.writeQuorum('x', 'v1', 1, 5);

    // Write version 2 to only nodes 0, 1, 2 (W = 3)
    const writeSuccess = cluster.writeQuorum('x', 'v2', 2, 3, [0, 1, 2]);
    assert.equal(writeSuccess, true);

    // Read from nodes 2, 3, 4 (R = 3, overlapping at node 2)
    const result = cluster.readQuorum('x', 3, [2, 3, 4]);
    assert.equal(result?.value, 'v2');
    assert.equal(result?.version, 2);
  });

  it('performs automatic Read Repair on stale replica nodes during read quorum', () => {
    const cluster = new QuorumCluster(3); // N = 3, W = 2, R = 2
    cluster.writeQuorum('counter', 'initial', 1, 3);

    // Write version 2 to nodes 0 and 1 only
    cluster.writeQuorum('counter', 'updated', 2, 2, [0, 1]);

    // Node 2 has stale version 1
    assert.equal(cluster.nodes[2]!.read('counter')?.version, 1);

    // Client reads quorum from nodes 1 and 2 with read repair enabled
    const res = cluster.readQuorum('counter', 2, [1, 2], true);
    assert.equal(res?.value, 'updated');

    // Verify Read Repair updated Node 2!
    assert.equal(cluster.nodes[2]!.read('counter')?.version, 2);
    assert.equal(cluster.nodes[2]!.read('counter')?.value, 'updated');
  });

  it('negative test: permits stale reads when W + R <= N', () => {
    // N = 5, W = 2, R = 2 -> W + R = 4 <= 5 (No guaranteed overlap!)
    const cluster = new QuorumCluster(5);
    cluster.writeQuorum('stock', 'v1', 1, 5);

    // Write v2 to nodes 0 and 1 only (W = 2)
    cluster.writeQuorum('stock', 'v2', 2, 2, [0, 1]);

    // Read from nodes 3 and 4 (R = 2; completely disjoint from write set!)
    const result = cluster.readQuorum('stock', 2, [3, 4], false);

    // Stale read anomaly! Returns old v1 because W + R <= N
    assert.equal(result?.value, 'v1');
    assert.equal(result?.version, 1);
  });
});
