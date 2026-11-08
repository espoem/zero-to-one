import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ShuffleShardingRouter } from './lib/aws-models.ts';

describe('Shuffle Sharding Allocation & Blast Radius Containment', () => {
  test('Combination Math: Calculates available virtual shards across fleet configurations', () => {
    // 8 nodes with 2 nodes per shard -> 28 unique shards
    const smallRouter = new ShuffleShardingRouter(8, 2);
    assert.equal(smallRouter.calculateCombinations(), 28);

    // 100 nodes with 4 nodes per shard -> 3,921,225 unique shards
    const enterpriseRouter = new ShuffleShardingRouter(100, 4);
    assert.equal(enterpriseRouter.calculateCombinations(), 3921225);
  });

  test('Deterministic Assignment: Consistent, sorted node allocation per tenant', () => {
    const router = new ShuffleShardingRouter(16, 4);

    const tenantA1 = router.assignTenant('tenant-corp-alpha');
    const tenantA2 = router.assignTenant('tenant-corp-alpha');
    assert.deepEqual(
      tenantA1,
      tenantA2,
      'Tenant assignment must be strictly idempotent and deterministic',
    );

    assert.equal(tenantA1.length, 4);
    // Node IDs must be unique
    const uniqueNodes = new Set(tenantA1);
    assert.equal(uniqueNodes.size, 4);

    const tenantB = router.assignTenant('tenant-corp-beta');
    assert.notDeepEqual(tenantA1, tenantB, 'Different tenants should receive diverse node shards');
  });

  test('Blast Radius Simulation: Containment of poison-pill tenant failure in a 100-node fleet', () => {
    const totalNodes = 100;
    const nodesPerShard = 4;
    const router = new ShuffleShardingRouter(totalNodes, nodesPerShard);

    // Generate 1,000 distinct candidate tenants
    const candidateTenants: string[] = [];
    for (let i = 0; i < 1000; i++) {
      candidateTenants.push(`tenant-${i.toString().padStart(4, '0')}`);
    }

    const poisonPillTenant = 'tenant-0042';

    // Simulate poison pill outage: tenant-0042 crashes all 4 of its assigned nodes
    const simulation = router.simulatePoisonPill(poisonPillTenant, candidateTenants);

    assert.equal(simulation.crashedNodes.length, 4);

    // In a 100-node fleet with k=4, the probability of any other tenant sharing all 4 nodes is 1 / 3,921,225 (~0.000025%)
    // Across 1,000 tenants, 0 other tenants should experience a total outage
    assert.equal(
      simulation.fullyDownedTenants.length,
      0,
      'Zero other tenants should suffer a complete outage from the poison pill tenant',
    );
    assert.equal(simulation.blastRadiusPercent, 0.0);

    // The vast majority of tenants share 0 nodes with the crashed nodes and suffer zero degradation
    assert.equal(
      simulation.unaffectedTenants.length > 800,
      true,
      `Expected over 80% unaffected tenants, actual: ${simulation.unaffectedTenants.length}/999`,
    );

    // Tenants that do overlap with 1 node retain 3 healthy nodes (75% capacity)
    for (const degradedTenant of simulation.degradedTenants) {
      const overlap = router.computeOverlap(poisonPillTenant, degradedTenant);
      assert.equal(
        overlap < nodesPerShard,
        true,
        'Degraded tenants must retain at least one operational node',
      );
      assert.equal(overlap >= 1, true);
    }
  });

  test('Overlap Bounds: Validates node intersection math between tenants', () => {
    const router = new ShuffleShardingRouter(20, 3);
    const overlapSelf = router.computeOverlap('tenant-x', 'tenant-x');
    assert.equal(overlapSelf, 3, 'A tenant overlaps completely with itself');

    const overlapOther = router.computeOverlap('tenant-x', 'tenant-y');
    assert.equal(overlapOther >= 0 && overlapOther <= 3, true);
  });
});
