// Module 07: Kubernetes Networking: CoreDNS ndots, Services, and NetworkPolicy
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCoreDnsSearchExpansion,
  evaluateEgressPolicy,
  cniSupportsNetworkPolicy,
  type NetworkPolicySpec,
} from './lib/kubernetes-model.ts';

test('CoreDNS ndots:5 causes external domains with <5 dots to query cluster search domains first', () => {
  const searchDomains = [
    'default.svc.cluster.local',
    'svc.cluster.local',
    'cluster.local',
    'corp.internal',
  ];

  // Query: api.stripe.com (2 dots < ndots:5)
  const expansion = calculateCoreDnsSearchExpansion('api.stripe.com', searchDomains, 5);

  assert.equal(expansion.resolvedImmediately, false);
  assert.equal(expansion.queriesIssued.length, 5);
  assert.equal(expansion.queriesIssued[0], 'api.stripe.com.default.svc.cluster.local');
  assert.equal(expansion.queriesIssued[1], 'api.stripe.com.svc.cluster.local');
  assert.equal(expansion.queriesIssued[2], 'api.stripe.com.cluster.local');
  assert.equal(expansion.queriesIssued[3], 'api.stripe.com.corp.internal');
  assert.equal(expansion.queriesIssued[4], 'api.stripe.com'); // Only now attempts the real domain!

  // Fully-qualified query with trailing dot or >= 5 dots resolves directly
  const fqdnExpansion = calculateCoreDnsSearchExpansion('api.stripe.com.', searchDomains, 5);
  assert.equal(fqdnExpansion.resolvedImmediately, true);
  assert.equal(fqdnExpansion.queriesIssued.length, 1);
  assert.equal(fqdnExpansion.queriesIssued[0], 'api.stripe.com');
  const absoluteExpansion = calculateCoreDnsSearchExpansion('a.b.c.d.e.com', searchDomains, 5);
  assert.equal(absoluteExpansion.resolvedImmediately, true);
  assert.equal(absoluteExpansion.queriesIssued.length, 1);
});

test('negative test: default-deny egress NetworkPolicy drops DNS port 53 if not explicitly allowed', () => {
  // Pod selected by default-deny egress policy with no egress rules
  const defaultDenyEgress: NetworkPolicySpec = {
    podSelector: { app: 'secure-vault' },
    policyTypes: ['Egress'],
    egress: [], // Deny all egress
  };

  const dnsEvaluation = evaluateEgressPolicy(53, 'UDP', [defaultDenyEgress]);
  assert.equal(dnsEvaluation.allowed, false);
  assert.ok(dnsEvaluation.blockedReason?.includes('missing DNS port 53 egress rule'));

  // With explicit egress rule for DNS port 53
  const allowDnsPolicy: NetworkPolicySpec = {
    podSelector: { app: 'secure-vault' },
    policyTypes: ['Egress'],
    egress: [
      {
        ports: [
          { protocol: 'UDP', port: 53 },
          { protocol: 'TCP', port: 53 },
        ],
      },
    ],
  };

  const allowedDns = evaluateEgressPolicy(53, 'UDP', [allowDnsPolicy]);
  assert.equal(allowedDns.allowed, true);
});

test('negative test: basic CNI (Flannel) silently fails to enforce NetworkPolicy', () => {
  assert.equal(cniSupportsNetworkPolicy('cilium'), true);
  assert.equal(cniSupportsNetworkPolicy('calico'), true);
  assert.equal(cniSupportsNetworkPolicy('antrea'), true);

  // Standard Flannel without network policy controller does not enforce rules!
  assert.equal(cniSupportsNetworkPolicy('flannel'), false);
  assert.equal(cniSupportsNetworkPolicy('bridge'), false);
});
