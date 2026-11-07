// Module 01: Declarative API and Level-Triggered Reconciliation
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  applyClientSide,
  applyServerSide,
  MetadataAnnotationsTooLongError,
  FieldOwnershipConflictError,
  ANNOTATION_SIZE_LIMIT_BYTES,
  LAST_APPLIED_CONFIG_ANNOTATION,
  type K8sObject,
} from './lib/kubernetes-model.ts';

test('client-side apply records serialized state in last-applied-configuration annotation', () => {
  const manifest: K8sObject = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: 'web-api',
      namespace: 'production',
      labels: { app: 'web' },
    },
    spec: {
      replicas: 3,
      template: { spec: { containers: [{ name: 'server', image: 'nginx:1.27' }] } },
    },
  };

  const applied = applyClientSide(null, manifest);
  assert.ok(applied.metadata.annotations);
  const recorded = JSON.parse(applied.metadata.annotations[LAST_APPLIED_CONFIG_ANNOTATION]!);
  assert.equal(recorded.spec.replicas, 3);
  assert.equal(applied.metadata.generation, 1);
});

test('negative test: client-side apply fails when manifest exceeds 256KB annotation limit', () => {
  // Generate massive config data exceeding 256 KB
  const largeData = 'x'.repeat(270 * 1024);
  const oversizedManifest: K8sObject = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: 'giant-crd-or-config',
      namespace: 'default',
    },
    spec: {
      blob: largeData,
    },
  };

  assert.throws(
    () => applyClientSide(null, oversizedManifest),
    (err: unknown) => {
      assert.ok(err instanceof MetadataAnnotationsTooLongError);
      assert.ok(err.message.includes('metadata.annotations too long'));
      assert.ok(err.message.includes(String(ANNOTATION_SIZE_LIMIT_BYTES)));
      return true;
    },
  );
});

test('server-side apply succeeds without annotation limit and tracks field managers', () => {
  const largeData = 'x'.repeat(270 * 1024);
  const largeManifest: K8sObject = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'giant-ssa-object', namespace: 'default' },
    spec: { blob: largeData },
  };

  // SSA does not store last-applied-configuration annotation
  const applied = applyServerSide(null, largeManifest, 'manager-ci');
  assert.equal(applied.metadata.annotations?.[LAST_APPLIED_CONFIG_ANNOTATION], undefined);
  assert.equal(applied.metadata.managedFields?.length, 1);
  assert.equal(applied.metadata.managedFields?.[0]?.manager, 'manager-ci');
});

test('negative test: server-side apply detects field manager conflict without force flag', () => {
  const initial: K8sObject = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'app', namespace: 'default' },
    spec: { replicas: 3 },
  };

  const appliedByDev = applyServerSide(null, initial, 'helm-release');

  const conflictingPatch: K8sObject = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'app', namespace: 'default' },
    spec: { replicas: 5 }, // HPA or manual kubectl trying to modify replicas
  };

  assert.throws(
    () => applyServerSide(appliedByDev, conflictingPatch, 'kubectl-developer', { force: false }),
    (err: unknown) => {
      assert.ok(err instanceof FieldOwnershipConflictError);
      assert.equal(err.conflicts.length, 1);
      assert.equal(err.conflicts[0]?.fieldPath, 'spec.replicas');
      assert.equal(err.conflicts[0]?.currentManager, 'helm-release');
      return true;
    },
  );
});

test('server-side apply force=true resolves ownership conflicts and takes over field', () => {
  const initial: K8sObject = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'app', namespace: 'default' },
    spec: { replicas: 3 },
  };

  const appliedByHelm = applyServerSide(null, initial, 'helm');
  const forcePatch: K8sObject = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'app', namespace: 'default' },
    spec: { replicas: 10 },
  };

  const forced = applyServerSide(appliedByHelm, forcePatch, 'keda-scaler', { force: true });
  assert.equal(forced.spec.replicas, 10);
  const activeManager = forced.metadata.managedFields?.find((m) => m.manager === 'keda-scaler');
  assert.ok(activeManager);
  assert.equal(activeManager.fieldsV1['replicas'], 10);
});

test('property-based test: Server-Side Apply is idempotent for identical patches', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer({ min: 1, max: 50 }),
      (name, replicas) => {
        const patch: K8sObject = {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name, namespace: 'prod' },
          spec: { replicas },
        };

        const first = applyServerSide(null, patch, 'ci-bot');
        const second = applyServerSide(first, patch, 'ci-bot');

        assert.equal(first.spec.replicas, second.spec.replicas);
        assert.equal(first.metadata.name, second.metadata.name);
      },
    ),
    { numRuns: 50 },
  );
});
