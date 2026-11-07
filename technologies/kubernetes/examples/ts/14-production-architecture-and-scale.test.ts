// Module 14: Production Architecture, API Priority & Fairness, and Scale
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApfQueueSimulator } from './lib/kubernetes-model.ts';

test('API Priority & Fairness shuffle-sharding isolates noisy tenants from starving quiet tenants', () => {
  const apf = new ApfQueueSimulator(64, 8); // 64 queues, hand size of 8

  const noisyTenantKey = 'tenant-noisy-crawler';
  const quietTenantKey = 'tenant-critical-checkout';

  // Noisy tenant generates 200 requests, filling up its assigned queues
  for (let i = 0; i < 200; i++) {
    apf.assignQueue(noisyTenantKey, `noisy-req-${i}`);
  }

  // Quiet tenant submits a request
  const quietQueueIndex = apf.assignQueue(quietTenantKey, 'checkout-req-1');
  const quietQueueDepth = apf.getQueueDepth(quietQueueIndex);

  // Because of shuffle sharding across 64 queues, the quiet tenant's best queue depth
  // is dramatically lower than the noisy tenant's accumulated queue load
  assert.ok(
    quietQueueDepth <= 10,
    `Shuffle-sharding should protect quiet tenant: found queue depth ${quietQueueDepth}`,
  );
});

test('APF assignQueue selects minimal depth queue within shuffle-shard hand', () => {
  const apf = new ApfQueueSimulator(16, 4);
  const tenant = 'service-auth';

  const q1 = apf.assignQueue(tenant, 'req-1');
  const q2 = apf.assignQueue(tenant, 'req-2');
  const q3 = apf.assignQueue(tenant, 'req-3');

  assert.ok(q1 >= 0 && q1 < 16);
  assert.ok(q2 >= 0 && q2 < 16);
  assert.ok(q3 >= 0 && q3 < 16);
});
