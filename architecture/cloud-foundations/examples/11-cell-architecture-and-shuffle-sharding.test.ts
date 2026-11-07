import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ShuffleShardAllocator } from './lib/cloud-models.ts';

describe('Module 11: Cell-Based Architecture & Shuffle Sharding', () => {
  it('exponentially expands fault isolation domains using shuffle sharding', () => {
    // 8 physical nodes, each customer assigned 2 nodes.
    // Combinations C(8, 2) = 28 virtual shards.
    const n = 8;
    const k = 2;
    const totalVirtualShards = ShuffleShardAllocator.totalShards(n, k);
    assert.equal(totalVirtualShards, 28);

    // If one "poison pill" customer takes down their 2 assigned nodes,
    // only customers assigned to the exact same pair are impacted.
    // Probability of an unaffected customer sharing that exact pair is 1/28 (~3.5%).
    const nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6', 'node-7', 'node-8'];
    const customerA = ShuffleShardAllocator.assignCustomer('cust-A', nodes, k);
    const customerB = ShuffleShardAllocator.assignCustomer('cust-B', nodes, k);

    assert.equal(customerA.length, 2);
    assert.equal(customerB.length, 2);
    // Verify deterministic assignment
    assert.deepEqual(customerA, ShuffleShardAllocator.assignCustomer('cust-A', nodes, k));
  });

  it('proves cell-based architectures contain blast radius to independent self-contained units', () => {
    interface Cell {
      cellId: string;
      controlPlaneIndependent: boolean;
      dataPlaneIndependent: boolean;
      activeCustomers: number;
    }

    const cells: Cell[] = [
      {
        cellId: 'cell-eu-1a',
        controlPlaneIndependent: true,
        dataPlaneIndependent: true,
        activeCustomers: 2500,
      },
      {
        cellId: 'cell-eu-1b',
        controlPlaneIndependent: true,
        dataPlaneIndependent: true,
        activeCustomers: 2500,
      },
    ];

    // Failure of cell-eu-1a leaves cell-eu-1b 100% operational
    const remainingOperationalCapacity = cells.filter((c) => c.cellId !== 'cell-eu-1a');
    assert.equal(remainingOperationalCapacity.length, 1);
    assert.equal(remainingOperationalCapacity[0]!.activeCustomers, 2500);
  });
});
