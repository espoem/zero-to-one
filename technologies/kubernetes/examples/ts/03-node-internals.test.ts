// Module 03: Node Internals: kubelet, cgroup v2, QoS, CFS Throttling, and PSI Eviction
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkKubeletCgroupSupport,
  classifyQoS,
  simulateCfsThrottling,
  determineEvictionOrder,
  type PodSpec,
} from './lib/kubernetes-model.ts';

test('negative test: kubelet v1.35+ refuses to start on legacy cgroup v1 hosts (FailCgroupV1=true)', () => {
  // Kubernetes 1.35+ with cgroup v1 host
  const check135 = checkKubeletCgroupSupport(1, '1.35.0', true);
  assert.equal(check135.ok, false);
  assert.ok(check135.error?.includes('cgroup v1 is unsupported'));

  // Kubernetes 1.37 with cgroup v1 host
  const check137 = checkKubeletCgroupSupport(1, '1.37.2', true);
  assert.equal(check137.ok, false);

  // Modern cgroup v2 host succeeds
  const checkV2 = checkKubeletCgroupSupport(2, '1.37.2', true);
  assert.equal(checkV2.ok, true);
  assert.equal(checkV2.error, undefined);
});

test('classifyQoS assigns Guaranteed, Burstable, and BestEffort classes strictly', () => {
  const guaranteedPod: PodSpec = {
    containers: [
      {
        name: 'database',
        image: 'postgres:16',
        resources: {
          requests: { cpu: '2000m', memory: '4Gi' },
          limits: { cpu: '2000m', memory: '4Gi' },
        },
      },
    ],
  };

  const burstablePod: PodSpec = {
    containers: [
      {
        name: 'web',
        image: 'node:26',
        resources: {
          requests: { cpu: '500m', memory: '512Mi' },
          limits: { cpu: '2000m', memory: '2Gi' },
        },
      },
    ],
  };

  const bestEffortPod: PodSpec = {
    containers: [
      {
        name: 'batch-worker',
        image: 'busybox',
      },
    ],
  };

  assert.equal(classifyQoS(guaranteedPod), 'Guaranteed');
  assert.equal(classifyQoS(burstablePod), 'Burstable');
  assert.equal(classifyQoS(bestEffortPod), 'BestEffort');
});

test('negative test: CFS CPU limits cause latency throttling while request-only avoids CFS stalls', () => {
  // Scenario: Workload requires 250ms of compute during a burst.
  // With 1.0 CPU limit (100ms quota per 100ms CFS period),
  // thread consumes 100ms in period 1, gets throttled for 100ms, consumes 100ms in period 2, throttled again...
  const withCpuLimit = simulateCfsThrottling(1.0, 250);
  assert.equal(withCpuLimit.isThrottled, true);
  assert.equal(withCpuLimit.throttledPeriods, 2);
  assert.ok(
    withCpuLimit.executionTimeMs >= 250,
    'CFS throttling stretches execution duration across multiple periods',
  );

  // Without CPU limit (requests only, no CFS ceiling clamp)
  const requestOnly = simulateCfsThrottling(null, 250);
  assert.equal(requestOnly.isThrottled, false);
  assert.equal(requestOnly.throttledPeriods, 0);
  assert.equal(requestOnly.executionTimeMs, 250);
});

test('negative test: under PSI node memory pressure, BestEffort pods are evicted first', () => {
  const pods = [
    { name: 'db-replica', qos: 'Guaranteed' as const, memoryUsageMb: 4000, memoryRequestMb: 4000 },
    { name: 'api-service', qos: 'Burstable' as const, memoryUsageMb: 800, memoryRequestMb: 256 },
    {
      name: 'background-crawler',
      qos: 'BestEffort' as const,
      memoryUsageMb: 600,
      memoryRequestMb: 0,
    },
  ];

  const evictionOrder = determineEvictionOrder(pods);

  // BestEffort MUST be evicted before Burstable, and Guaranteed must be preserved last
  assert.equal(evictionOrder[0], 'background-crawler');
  assert.equal(evictionOrder[1], 'api-service');
  assert.equal(evictionOrder[2], 'db-replica');
});
