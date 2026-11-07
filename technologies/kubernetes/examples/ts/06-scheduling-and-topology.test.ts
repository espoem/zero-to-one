// Module 06: Scheduling Architecture: Filter/Score, Taints, and PDB Deadlocks
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNodes,
  simulateNodeDrain,
  type NodeInfo,
  type SchedulingPod,
  type PodDisruptionBudget,
} from './lib/kubernetes-model.ts';

test('scheduler filter pipeline filters nodes by resources, nodeSelector, and taints', () => {
  const nodes: NodeInfo[] = [
    {
      name: 'node-small',
      labels: { 'topology.kubernetes.io/zone': 'us-east-1a' },
      allocatableCpu: 2,
      allocatableMemoryMb: 2048,
      usedCpu: 1.5,
      usedMemoryMb: 1800,
    },
    {
      name: 'node-tainted',
      labels: { 'topology.kubernetes.io/zone': 'us-east-1a' },
      taints: [{ key: 'dedicated', value: 'gpu', effect: 'NoSchedule' }],
      allocatableCpu: 16,
      allocatableMemoryMb: 32768,
      usedCpu: 2,
      usedMemoryMb: 4096,
    },
    {
      name: 'node-target',
      labels: { 'topology.kubernetes.io/zone': 'us-east-1b', env: 'production' },
      allocatableCpu: 8,
      allocatableMemoryMb: 16384,
      usedCpu: 2,
      usedMemoryMb: 4096,
    },
  ];

  const pod: SchedulingPod = {
    name: 'prod-api',
    requiredCpu: 2,
    requiredMemoryMb: 4096,
    nodeSelector: { env: 'production' },
  };

  const { eligible, failures } = filterNodes(pod, nodes);

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]?.name, 'node-target');
  assert.ok(failures.get('node-small')?.some((f) => f.includes('Insufficient CPU')));
  assert.ok(failures.get('node-tainted')?.some((f) => f.includes('UntoleratedTaint')));
});

test('negative test: PDB with minAvailable == replicas blocks node drain indefinitely (drain deadlock)', () => {
  const pod = { name: 'singleton-db-0', labels: { app: 'postgres' }, namespace: 'db' };
  const allPods = [{ ...pod, node: 'worker-1' }];
  const pdbs: PodDisruptionBudget[] = [
    {
      name: 'postgres-pdb',
      selector: { app: 'postgres' },
      minAvailable: 1, // 1 available out of 1 replica -> 0 disruptions permitted!
    },
  ];

  const drainResult = simulateNodeDrain('worker-1', [pod], allPods, pdbs);

  assert.equal(drainResult.canDrain, false);
  assert.ok(drainResult.blockedReason?.includes('drain deadlock'));
  assert.ok(drainResult.blockedReason?.includes('disruptionsAllowed = 0'));
});

test('node drain succeeds when PDB allows disruptions', () => {
  const podsOnNode = [{ name: 'web-1', labels: { app: 'web' }, namespace: 'default' }];
  const allPods = [
    { name: 'web-1', labels: { app: 'web' }, namespace: 'default', node: 'worker-1' },
    { name: 'web-2', labels: { app: 'web' }, namespace: 'default', node: 'worker-2' },
    { name: 'web-3', labels: { app: 'web' }, namespace: 'default', node: 'worker-3' },
  ];
  const pdbs: PodDisruptionBudget[] = [
    {
      name: 'web-pdb',
      selector: { app: 'web' },
      minAvailable: 2, // 3 replicas, minAvailable 2 -> 1 disruption permitted!
    },
  ];

  const drainResult = simulateNodeDrain('worker-1', podsOnNode, allPods, pdbs);
  assert.equal(drainResult.canDrain, true);
});
