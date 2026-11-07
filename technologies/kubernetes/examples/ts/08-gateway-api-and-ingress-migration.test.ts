// Module 08: Gateway API v1.6 and Ingress Migration
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCrossNamespaceRouting,
  auditIngressControllerMigration,
  type ReferenceGrant,
  type HTTPRouteBackendRef,
} from './lib/kubernetes-model.ts';

test('negative test: retired k8s.io/ingress-nginx post-March 2026 retirement triggers Gateway API migration recommendation (Gotcha #17)', () => {
  const audit = auditIngressControllerMigration('nginx', true, false);
  assert.equal(audit.status, 'NonCompliant');
  assert.ok(audit.recommendation.includes('ingress-nginx'));
  assert.ok(audit.recommendation.includes('Gateway API v1.5'));

  const compliantAudit = auditIngressControllerMigration('custom', false, true);
  assert.equal(compliantAudit.status, 'Compliant');
});

test('negative test: cross-namespace HTTPRoute backend reference fails without ReferenceGrant', () => {
  const backend: HTTPRouteBackendRef = {
    name: 'order-service',
    namespace: 'inventory', // Cross-namespace backend!
    port: 8080,
  };

  const grants: ReferenceGrant[] = []; // No ReferenceGrant created in inventory namespace

  const result = evaluateCrossNamespaceRouting('frontend', backend, grants);

  assert.equal(result.allowed, false);
  assert.ok(result.condition.includes('ResolvedRefs: False'));
  assert.ok(result.condition.includes('ReferenceGrant missing in target namespace'));
});

test('cross-namespace routing succeeds when ReferenceGrant permits route namespace', () => {
  const backend: HTTPRouteBackendRef = {
    name: 'order-service',
    namespace: 'inventory',
    port: 8080,
  };

  const grants: ReferenceGrant[] = [
    {
      metadata: { name: 'allow-frontend-routes', namespace: 'inventory' },
      spec: {
        from: [{ group: 'gateway.networking.k8s.io', kind: 'HTTPRoute', namespace: 'frontend' }],
        to: [{ group: '', kind: 'Service', name: 'order-service' }],
      },
    },
  ];

  const result = evaluateCrossNamespaceRouting('frontend', backend, grants);

  assert.equal(result.allowed, true);
  assert.equal(result.condition, 'ResolvedRefs: True');
});

test('intra-namespace routing succeeds without ReferenceGrant', () => {
  const backend: HTTPRouteBackendRef = {
    name: 'user-service',
    namespace: 'frontend', // Same namespace
    port: 3000,
  };

  const result = evaluateCrossNamespaceRouting('frontend', backend, []);
  assert.equal(result.allowed, true);
  assert.equal(result.condition, 'ResolvedRefs: True');
});
