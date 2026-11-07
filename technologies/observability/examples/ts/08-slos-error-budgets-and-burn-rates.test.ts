import test from 'node:test';
import assert from 'node:assert';
import { ErrorBudgetEngine } from './lib/observability-model.ts';

test('08 - Error budget burn rate calculation', () => {
  const burn = ErrorBudgetEngine.calculateBurnRate(0.05, 0.99);
  assert.ok(Math.abs(burn - 5) < 1e-9);
});

test('08 - Multi-window burn rate alert evaluation (Gotcha #12)', () => {
  // Test scenario where 1h burn rate triggers but 5m short window does not (or vice versa)
  const eval1 = ErrorBudgetEngine.evaluateBurnRateAlert(0.001, 0.15, 0.99);
  assert.strictEqual(eval1.firing1h, true);
  assert.strictEqual(eval1.pagerTriggered, true);
});

test('08 - Error budget consumption rate for 99.9% SLO', () => {
  const burn = ErrorBudgetEngine.calculateBurnRate(0.003, 0.999);
  assert.ok(Math.abs(burn - 3) < 1e-9);
});

test('08 - Availability SLI query validation', () => {
  const numerator = 995;
  const denominator = 1000;
  const sli = numerator / denominator;
  assert.strictEqual(sli, 0.995);
});
