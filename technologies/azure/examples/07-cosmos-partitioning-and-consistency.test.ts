import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CosmosConsistencyWorld,
  CosmosThroughputPool,
  HierarchicalPartitionCollection,
  LOGICAL_PARTITION_LIMIT_BYTES,
  LogicalPartition,
  MAX_PARTITION_RU_PER_SEC,
  estimatePointReadRu,
  estimateQueryRu,
} from './lib/azure-models.ts';

const GB = 1024 * 1024 * 1024;

describe('Cosmos DB: partitioning, throttling and consistency', () => {
  test('Negative: writes past 20 GB in one logical partition fail with 403/1014', () => {
    assert.equal(LOGICAL_PARTITION_LIMIT_BYTES, 20 * GB);
    const partition = new LogicalPartition();
    assert.equal(partition.write(19 * GB).status, 201);
    const over = partition.write(2 * GB);
    assert.equal(over.status, 403);
    assert.equal(over.substatus, 1014);
    assert.equal(over.code, 'PartitionKeyRangeIsFull');
    assert.equal(partition.bytesUsed, 19 * GB);
  });

  test('Hierarchical partition keys keep every logical partition under 20 GB', () => {
    const collection = new HierarchicalPartitionCollection(['tenantId', 'userId']);
    for (let tenant = 0; tenant < 4; tenant += 1) {
      for (let user = 0; user < 25; user += 1) {
        const result = collection.write({ tenantId: `t${tenant}`, userId: `u${user}` }, 1 * GB);
        assert.equal(result.status, 201);
      }
    }
    assert.equal(collection.partitionCount(), 100);
    assert.ok(collection.maxUsageBytes() <= 1 * GB);

    const flat = new HierarchicalPartitionCollection(['tenantId']);
    for (let i = 0; i < 19; i += 1) {
      assert.equal(flat.write({ tenantId: 'single' }, 1 * GB).status, 201);
    }
    assert.equal(flat.write({ tenantId: 'single' }, 2 * GB).status, 403);
  });

  test('Negative: hot partition capped at its share emits 429 with x-ms-retry-after-ms', () => {
    const pool = new CosmosThroughputPool({ totalRuPerSec: 50_000, physicalPartitionCount: 5 });
    assert.equal(pool.perPartitionCap(), 10_000);

    // Find a key that maps to a fixed partition and hammer it within one window.
    const hotKey = 'hot-tenant';
    let consumed = 0;
    let throttledAt = -1;
    for (let i = 0; i < 12; i += 1) {
      const result = pool.consumeAt(hotKey, 1_000, 0);
      if (result.throttled) {
        throttledAt = i;
        assert.equal(result.status, 429);
        assert.ok(result.retryAfterMs > 0, 'x-ms-retry-after-ms must be present');
        break;
      }
      consumed += 1;
    }
    assert.equal(consumed, 10);
    assert.equal(throttledAt, 10);

    // Even a single physical partition with 20,000 RU/s provisioned caps at 10,000 RU/s.
    const singlePartitionOverprovisioned = new CosmosThroughputPool({
      totalRuPerSec: 20_000,
      physicalPartitionCount: 1,
    });
    assert.equal(MAX_PARTITION_RU_PER_SEC, 10_000);
    assert.equal(singlePartitionOverprovisioned.perPartitionCap(), 10_000);
    assert.equal(singlePartitionOverprovisioned.consumeAt('k', 10_000, 0).throttled, false);
    assert.equal(singlePartitionOverprovisioned.consumeAt('k', 1, 0).status, 429);
  });

  test('RU cost model and HPK prefix routing: leading prefix targets partitions, omitting it forces fan-out', () => {
    const collection = new HierarchicalPartitionCollection(['tenantId', 'userId', 'sessionId']);
    for (let t = 0; t < 10; t += 1) {
      for (let u = 0; u < 5; u += 1) {
        collection.write({ tenantId: `t${t}`, userId: `u${u}`, sessionId: 's1' }, 1024);
      }
    }

    const totalPhysical = 10;
    const fullKey = collection.routeQuery(
      { tenantId: 't1', userId: 'u2', sessionId: 's1' },
      totalPhysical,
    );
    assert.equal(fullKey.strategy, 'single-partition');
    assert.equal(fullKey.partitionsContacted, 1);

    const leadingPrefix = collection.routeQuery({ tenantId: 't1' }, totalPhysical);
    assert.equal(leadingPrefix.strategy, 'prefix-targeted');
    assert.ok(leadingPrefix.partitionsContacted < totalPhysical);

    // Negative: omitting leading level tenantId forces full cross-partition fan-out.
    const fanOut = collection.routeQuery({ userId: 'u2' }, totalPhysical);
    assert.equal(fanOut.strategy, 'fan-out');
    assert.equal(fanOut.partitionsContacted, totalPhysical);

    // RU multiplication: 1 KB point read (1 RU) vs single-partition query vs 10-partition fan-out.
    const pointRu = estimatePointReadRu(1);
    const singleQueryRu = estimateQueryRu({
      partitionsContacted: fullKey.partitionsContacted,
      matchedItems: 1,
      itemSizeKb: 1,
    });
    const fanOutQueryRu = estimateQueryRu({
      partitionsContacted: fanOut.partitionsContacted,
      matchedItems: 1,
      itemSizeKb: 1,
    });
    assert.equal(pointRu, 1);
    assert.ok(singleQueryRu > pointRu);
    assert.ok(fanOutQueryRu > singleQueryRu * 5);
  });

  test('SDK retry loop obeying x-ms-retry-after-ms succeeds; splitting the hot key removes throttling', () => {
    const pool = new CosmosThroughputPool({ totalRuPerSec: 50_000, physicalPartitionCount: 5 });
    const retry = pool.consumeWithRetry('hot-tenant', 10_000, 0);
    assert.equal(retry.ok, true);
    assert.equal(retry.attempts, 1);

    // A request that fits the cap but arrives in an exhausted window must back
    // off past x-ms-retry-after-ms and succeed in the next window.
    const windowed = new CosmosThroughputPool({
      totalRuPerSec: 50_000,
      physicalPartitionCount: 5,
    });
    const prefill = windowed.consumeAt('hot-tenant', 6_000, 0);
    assert.equal(prefill.throttled, false);
    const overWindow = windowed.consumeWithRetry('hot-tenant', 6_000, 0, 3);
    assert.equal(overWindow.ok, true);
    assert.ok(overWindow.attempts > 1, 'retry loop must back off past the throttle');

    const spread = new CosmosThroughputPool({
      totalRuPerSec: 50_000,
      physicalPartitionCount: 5,
    });
    const seen = new Set<number>();
    for (let shard = 0; shard < 5; shard += 1) {
      const key = `hot-tenant#${shard}`;
      seen.add(spread.locatePartition(key));
      assert.equal(spread.consumeAt(key, 2_000, 0).throttled, false);
    }
    assert.ok(seen.size >= 1);
  });

  test('Strong reads are linearizable: always the latest committed write', () => {
    const world = new CosmosConsistencyWorld();
    world.write('a');
    world.write('b');
    world.setReplicaLag(2);
    const read = world.read({ consistency: 'Strong' });
    assert.equal(read.value, 'b');
    assert.equal(read.lsn, 2);
    assert.equal(read.stale, false);
  });

  test('Bounded staleness: replica lag never exceeds K versions', () => {
    const world = new CosmosConsistencyWorld();
    for (let i = 0; i < 10; i += 1) {
      world.write(`v${i}`);
    }
    world.setReplicaLag(5);
    const read = world.read({ consistency: 'BoundedStaleness', maxStalenessVersions: 5 });
    assert.equal(read.lsn, 5);
    assert.equal(world.replicaLag(), 5);
    assert.throws(
      () => world.read({ consistency: 'BoundedStaleness', maxStalenessVersions: 4 }),
      /BoundedStaleness violated/,
    );
  });

  test('Negative: Session reads without the token break read-your-writes; with it they hold', () => {
    const world = new CosmosConsistencyWorld();
    world.write('v1');
    world.replicateAll();
    const token = world.write('v2');
    assert.equal(token, 2);
    world.setReplicaLag(1);

    const withoutToken = world.read({ consistency: 'Session' });
    assert.equal(withoutToken.value, 'v1');
    assert.equal(withoutToken.stale, true);

    const withToken = world.read({ consistency: 'Session', sessionToken: token });
    assert.equal(withToken.value, 'v2');
    assert.equal(withToken.lsn, 2);
  });

  test('Consistent Prefix: replica reads never regress or show gaps out of order', () => {
    const world = new CosmosConsistencyWorld();
    for (let i = 1; i <= 6; i += 1) {
      world.write(`v${i}`);
    }
    world.setReplicaLag(4);
    let lastLsn = 0;
    for (const lag of [4, 3, 2, 1, 0]) {
      world.setReplicaLag(lag);
      const read = world.read({ consistency: 'ConsistentPrefix' });
      assert.ok(read.lsn >= lastLsn, 'prefix reads must be non-decreasing');
      lastLsn = read.lsn;
    }
    assert.equal(lastLsn, 6);
  });

  test('Eventual: replica converges after replication catches up', () => {
    const world = new CosmosConsistencyWorld();
    world.write('v1');
    world.write('v2');
    world.setReplicaLag(2);
    assert.equal(world.read({ consistency: 'Eventual' }).value, undefined);
    world.replicateAll();
    const converged = world.read({ consistency: 'Eventual' });
    assert.equal(converged.value, 'v2');
    assert.equal(converged.stale, false);
  });
});
