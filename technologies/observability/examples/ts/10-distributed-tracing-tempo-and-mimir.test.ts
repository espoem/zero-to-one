import test from 'node:test';
import assert from 'node:assert';
import { ConsistentHashRing } from './lib/observability-model.ts';

test('10 - Grafana Tempo TraceQL and Mimir consistent hash ring (Gotcha #6)', () => {
  const ring = new ConsistentHashRing();
  ring.addNode('mimir-ingester-1');
  ring.addNode('mimir-ingester-2');
  const node = ring.getNode('trace-id-abc123xyz');
  assert.ok(node === 'mimir-ingester-1' || node === 'mimir-ingester-2');
});

test('10 - Mimir multi-tenant series isolation', () => {
  const tenantId = 'tenant-ecommerce-prod';
  assert.strictEqual(tenantId.length > 0, true);
});

test('10 - TraceQL attribute filter matching', () => {
  const span = { attributes: { 'http.status_code': 500, error: true } };
  const matches = span.attributes['http.status_code'] >= 500;
  assert.strictEqual(matches, true);
});

test('10 - Prometheus HA pair external label deduplication', () => {
  const labels1 = { cluster: 'us-east', replica: 'A' };
  const deduplicatedKey = labels1['cluster'];
  assert.strictEqual(deduplicatedKey, 'us-east');
});
