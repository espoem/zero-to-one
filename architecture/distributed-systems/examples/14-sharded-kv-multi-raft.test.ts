import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Shard Configuration mapping shard ID -> Replica Group ID.
 */
export interface ShardConfig {
  configNum: number;
  shards: number[]; // Index: shardId, Value: groupId
  groups: Map<number, string[]>; // groupId -> server addresses
}

/**
 * Shard Controller maintaining cluster configuration versions.
 */
export class ShardController {
  private configNum = 1;
  private readonly shardToGroup: number[];

  constructor(numShards = 10) {
    // Initially all shards belong to group 100
    this.shardToGroup = new Array<number>(numShards).fill(100);
  }

  getGroupForShard(shardId: number): number {
    return this.shardToGroup[shardId] ?? 100;
  }

  // Rebalance: move shard to target group
  reassignShard(shardId: number, targetGroupId: number): number {
    this.shardToGroup[shardId] = targetGroupId;
    this.configNum++;
    return this.configNum;
  }
}

/**
 * Replica Group acting as a localized Raft state machine partition.
 */
export class ReplicaGroup {
  readonly groupId: number;
  private readonly store = new Map<string, string>();
  private readonly activeShards = new Set<number>();

  constructor(groupId: number, initialShards: number[]) {
    this.groupId = groupId;
    for (const s of initialShards) this.activeShards.add(s);
  }

  assignShard(shardId: number, snapshotData: Map<string, string>): void {
    this.activeShards.add(shardId);
    for (const [k, v] of snapshotData.entries()) {
      this.store.set(k, v);
    }
  }

  freezeAndExtractShard(shardId: number): Map<string, string> {
    if (!this.activeShards.has(shardId)) {
      throw new Error(`Group ${this.groupId} does not own shard ${shardId}`);
    }
    this.activeShards.delete(shardId); // Freeze writes!

    const snapshot = new Map<string, string>();
    for (const [k, v] of this.store.entries()) {
      snapshot.set(k, v);
    }
    return snapshot;
  }

  put(shardId: number, key: string, value: string): boolean {
    if (!this.activeShards.has(shardId)) return false; // Wrong group!
    this.store.set(key, value);
    return true;
  }

  get(shardId: number, key: string): string | null {
    if (!this.activeShards.has(shardId)) return null;
    return this.store.get(key) ?? null;
  }
}

test('Module 14: Sharded Multi-Raft Key-Value Store & Handoff', async (t) => {
  await t.test('Routes keys to assigned replica group via shard controller', () => {
    const controller = new ShardController(10);
    // Group 100 owns shard 0; Group 200 owns shard 1
    controller.reassignShard(1, 200);

    const group100 = new ReplicaGroup(100, [0]);
    const group200 = new ReplicaGroup(200, [1]);

    // Write to shard 0 succeeds on group 100
    assert.equal(group100.put(0, 'order_123', 'DetailsA'), true);
    assert.equal(group100.get(0, 'order_123'), 'DetailsA');

    // Write to shard 1 rejected on group 100, succeeds on group 200
    assert.equal(group100.put(1, 'order_456', 'DetailsB'), false);
    assert.equal(group200.put(1, 'order_456', 'DetailsB'), true);
    assert.equal(group200.get(1, 'order_456'), 'DetailsB');
  });

  await t.test('Shard migration freezes source group and transfers snapshot preserving linearizability', () => {
    const group100 = new ReplicaGroup(100, [0]);
    const group200 = new ReplicaGroup(200, []);

    // Initial write to Shard 0 in Group 100
    group100.put(0, 'user_profile', 'ActiveProfileData');

    // Migration initiated: Group 100 freezes Shard 0 and creates snapshot
    const snapshot = group100.freezeAndExtractShard(0);

    // Group 100 will now REJECT new writes to Shard 0 (frozen!)
    assert.equal(group100.put(0, 'user_profile', 'NewStaleData'), false);

    // Group 200 installs snapshot and activates Shard 0
    group200.assignShard(0, snapshot);

    // Group 200 can now serve reads and writes with zero data loss
    assert.equal(group200.get(0, 'user_profile'), 'ActiveProfileData');
    assert.equal(group200.put(0, 'user_profile', 'UpdatedProfileData'), true);
    assert.equal(group200.get(0, 'user_profile'), 'UpdatedProfileData');
  });
});
