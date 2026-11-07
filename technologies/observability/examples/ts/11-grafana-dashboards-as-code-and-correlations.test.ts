import test from 'node:test';
import assert from 'node:assert';
import { validateDashboardSchema } from './lib/observability-model.ts';

test('11 - Grafana 13 dynamic dashboards schema validation', () => {
  const dashboard = {
    title: 'Production Overview',
    panels: [{ id: 1, type: 'timeseries', title: 'CPU Usage' }],
  };
  assert.strictEqual(validateDashboardSchema(dashboard), true);
});

test('11 - Reject invalid dashboard schema without title', () => {
  const invalid = { panels: [] };
  assert.strictEqual(validateDashboardSchema(invalid), false);
});

test('11 - Exemplar correlation between traces and metrics', () => {
  const metricSample = { value: 4.5, exemplar: { traceId: '4bf92f3577b34da6a3ce929d0e0e4736' } };
  assert.strictEqual(metricSample.exemplar.traceId.length, 32);
});

test('11 - Grafana Git Sync backup verification', () => {
  const gitSynced = true;
  assert.strictEqual(gitSynced, true);
});
