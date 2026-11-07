// Module 12: Extending Kubernetes: CRDs, Operators, Finalizers, and Helm vs Kustomize
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ControllerReconciler,
  detectOrphanedFinalizerDeadlock,
  type K8sObject,
} from './lib/kubernetes-model.ts';

test('negative test: orphaned finalizers keep deleted objects stuck in Terminating status', async () => {
  const customResource: K8sObject = {
    apiVersion: 'database.example.com/v1alpha1',
    kind: 'PostgresCluster',
    metadata: {
      name: 'prod-pg',
      namespace: 'db',
      deletionTimestamp: '2026-11-07T12:00:00Z', // User issued `kubectl delete`
      finalizers: ['database.example.com/cloud-disks-cleanup'],
    },
    spec: { size: '100Gi' },
  };

  const deadlock = detectOrphanedFinalizerDeadlock(customResource.metadata, false);
  assert.equal(deadlock.isStuck, true);
  assert.ok(deadlock.reason.includes('stuck in Terminating status'));
  assert.ok(deadlock.reason.includes('controller managing them is unreachable'));
});

test('controller reconcile loop removes finalizer after external resource teardown', async () => {
  const customResource: K8sObject = {
    apiVersion: 'database.example.com/v1alpha1',
    kind: 'PostgresCluster',
    metadata: {
      name: 'prod-pg',
      namespace: 'db',
      deletionTimestamp: '2026-11-07T12:00:00Z',
      finalizers: ['database.example.com/cloud-disks-cleanup'],
    },
    spec: { size: '100Gi' },
  };

  const reconciler = new ControllerReconciler<K8sObject>();
  let cloudDisksDeleted = false;

  const result = await reconciler.reconcile(customResource, async () => {
    // External cloud cleanup
    cloudDisksDeleted = true;
  });

  assert.equal(result.requeue, false);
  assert.equal(cloudDisksDeleted, true);
  assert.equal(customResource.metadata.finalizers?.length, 0); // Finalizer cleared, apiserver can finalize garbage collection!
});

test('controller reconcile is idempotent across multiple invocations', async () => {
  const normalResource: K8sObject = {
    apiVersion: 'apps.example.com/v1',
    kind: 'Widget',
    metadata: { name: 'widget-1', namespace: 'default' },
    spec: { replicas: 3 },
  };

  const reconciler = new ControllerReconciler<K8sObject>();

  const res1 = await reconciler.reconcile(normalResource);
  const res2 = await reconciler.reconcile(normalResource);

  assert.equal(res1.requeue, false);
  assert.equal(res2.requeue, false);
  assert.equal(reconciler.reconcileCalls, 2);
});
