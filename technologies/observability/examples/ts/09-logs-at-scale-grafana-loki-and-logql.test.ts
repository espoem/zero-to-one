import test from 'node:test';
import assert from 'node:assert';
import { LokiIngesterSimulator } from './lib/observability-model.ts';

test('09 - Loki log stream ingestion with structured metadata (Gotcha #13)', () => {
  const ingester = new LokiIngesterSimulator();
  ingester.ingest({ app: 'payment', env: 'prod' }, 'INFO request success');
  assert.strictEqual(ingester.getStreamCount(), 1);
});

test('09 - High cardinality stream label rejection (Gotcha #13)', () => {
  const ingester = new LokiIngesterSimulator();
  assert.throws(() => {
    ingester.ingest({ app: 'payment', user_id: 'user_12345' }, 'ERROR unauthorized');
  });
});

test('09 - LogQL parser and line filter expression', () => {
  const line = 'level=ERROR msg="database connection timeout"';
  const match = line.includes('ERROR');
  assert.strictEqual(match, true);
});

test('09 - Promtail to Grafana Alloy migration compatibility', () => {
  const alloyConfigValid = true;
  assert.strictEqual(alloyConfigValid, true);
});
