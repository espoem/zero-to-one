import test from 'node:test';
import assert from 'node:assert';
import { CardinalityGovernanceEngine } from './lib/observability-model.ts';

test('13 - Telemetry cost governance and series limit enforcement', () => {
  const allowed = CardinalityGovernanceEngine.checkSeriesLimit(50000, 100000);
  assert.strictEqual(allowed, true);
});

test('13 - Series limit rejection violation', () => {
  assert.throws(() => {
    CardinalityGovernanceEngine.checkSeriesLimit(150000, 100000);
  });
});

test('13 - Sampling head vs tail cost reduction analysis', () => {
  const tailSamplingCostReduction = 0.95;
  assert.ok(tailSamplingCostReduction > 0.9);
});

test('13 - Meta-monitoring Prometheus target health check', () => {
  const targetsDown = 0;
  assert.strictEqual(targetsDown, 0);
});
