// Module 02: Control Plane Internals: kube-apiserver, Webhooks, Informers, and etcd MVCC
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeAdmissionPipeline,
  InformerCache,
  EtcdMvccEngine,
  paginateList,
  type K8sObject,
} from './lib/kubernetes-model.ts';

test('admission pipeline executes stages in strict sequence (authn -> authz -> mutating -> schema -> validating -> etcd)', () => {
  const pod: K8sObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'worker-pod', namespace: 'default' },
    spec: { containers: [{ name: 'app', image: 'redis:7' }] },
  };

  const result = executeAdmissionPipeline(pod, {
    authenticated: true,
    authorized: true,
    schemaValid: true,
    webhooks: [
      {
        name: 'sidecar-injector',
        type: 'mutating',
        failurePolicy: 'Fail',
        isHealthy: true,
        mutateFn: (obj) => {
          obj.metadata.labels = { ...obj.metadata.labels, injected: 'true' };
          return obj;
        },
      },
      {
        name: 'security-guard',
        type: 'validating',
        failurePolicy: 'Fail',
        isHealthy: true,
        validateFn: () => ({ allowed: true }),
      },
    ],
  });

  assert.equal(result.allowed, true);
  assert.equal(result.stage, 'etcd');
  assert.equal(result.object.metadata.labels.injected, 'true');
});

test('negative test: webhook failurePolicy: Fail causes admission rejection when webhook is down', () => {
  const pod: K8sObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'app-pod', namespace: 'default' },
  };

  // Webhook service is offline / crashing
  const result = executeAdmissionPipeline(pod, {
    authenticated: true,
    authorized: true,
    schemaValid: true,
    webhooks: [
      {
        name: 'critical-admission-webhook',
        type: 'mutating',
        failurePolicy: 'Fail',
        isHealthy: false, // Backend unavailable
      },
    ],
  });

  assert.equal(result.allowed, false);
  assert.equal(result.stage, 'mutating');
  assert.equal(result.statusCode, 500);
  assert.ok(result.message?.includes('admission deadlock'));
});

test('webhook failurePolicy: Ignore permits requests to proceed during webhook degradation', () => {
  const pod: K8sObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'app-pod', namespace: 'default' },
  };

  const result = executeAdmissionPipeline(pod, {
    authenticated: true,
    authorized: true,
    schemaValid: true,
    webhooks: [
      {
        name: 'non-critical-telemetry-webhook',
        type: 'mutating',
        failurePolicy: 'Ignore',
        isHealthy: false,
      },
    ],
  });

  assert.equal(result.allowed, true);
  assert.equal(result.stage, 'etcd');
});

test('informer cache advances resourceVersion via watch bookmarks without re-listing', () => {
  const cache = new InformerCache<K8sObject>([
    { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'pod-1', namespace: 'default' } },
  ]);

  assert.equal(cache.size(), 1);
  assert.equal(cache.currentResourceVersion, 0);

  cache.handleBookmark({ type: 'BOOKMARK', resourceVersion: '105400' });
  assert.equal(cache.currentResourceVersion, 105400);

  // Stale bookmark does not roll back resourceVersion
  cache.handleBookmark({ type: 'BOOKMARK', resourceVersion: '99000' });
  assert.equal(cache.currentResourceVersion, 105400);
});

test('negative test: unpaginated LIST incurs high memory payload compared to chunked pagination', () => {
  const objects = Array.from({ length: 500 }, (_, i) => ({
    id: `resource-${i}`,
    payload: 'metadata-chunk-with-annotations-and-specs'.repeat(10),
  }));

  // Full unpaginated LIST
  const unpaginated = paginateList(objects);
  // Paginated chunks (limit: 50)
  const paginated = paginateList(objects, { limit: 50 });

  assert.equal(unpaginated.items.length, 500);
  assert.equal(paginated.items.length, 50);
  assert.ok(paginated.continueToken !== undefined);
  assert.ok(
    paginated.memoryPayloadBytes < unpaginated.memoryPayloadBytes * 0.15,
    'Paginated chunk payload must be significantly lower to prevent apiserver memory exhaustion',
  );
});

test('negative test: etcd quota exhaustion triggers mvcc: database space exceeded alarm and read-only lock', () => {
  // Simulate 1 MB quota for fast deterministic assertion
  const quota = 100 * 1024; // 100 KB
  const etcd = new EtcdMvccEngine(quota);

  const key = '/registry/pods/default/pod-1';
  etcd.put(key, 'initial-pod-spec');
  assert.equal(etcd.get(key), 'initial-pod-spec');

  // Fill up database space
  const massiveData = 'v'.repeat(50 * 1024);
  etcd.put('/registry/config/c1', massiveData);

  assert.throws(
    () => etcd.put('/registry/config/c2', massiveData),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('mvcc: database space exceeded'));
      return true;
    },
  );

  assert.equal(etcd.alarmNoSpace, true);

  // Reads must still succeed in read-only mode!
  assert.equal(etcd.get(key), 'initial-pod-spec');

  // Defrag clears space and disarms alarm
  etcd.defrag();
  assert.equal(etcd.alarmNoSpace, false);
  etcd.put('/registry/config/after-defrag', 'success');
  assert.equal(etcd.get('/registry/config/after-defrag'), 'success');
});
