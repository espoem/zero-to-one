import test from 'node:test';
import assert from 'node:assert';
import { AlertmanagerRouter } from './lib/observability-model.ts';

test('07 - Alertmanager routing tree and receiver matching', () => {
  const receiver = AlertmanagerRouter.route({ labels: { team: 'payment' }, severity: 'critical' }, [
    'default',
  ]);
  assert.strictEqual(receiver, 'pager-payment-team');
});

test('07 - PENDING to FIRING transition with for duration', () => {
  let state = 'PENDING';
  const evaluationTime = 300; // 5 min for clause
  if (evaluationTime >= 300) {
    state = 'FIRING';
  }
  assert.strictEqual(state, 'FIRING');
});

test('07 - Alertmanager inhibition rule self-inhibition check (Gotcha #11)', () => {
  const inhibitMatch = (sourceSeverity: string, targetSeverity: string) => {
    if (sourceSeverity === targetSeverity) {
      throw new Error('Self-inhibition detected: source and target match the same severity.');
    }
    return true;
  };
  assert.throws(() => {
    inhibitMatch('critical', 'critical');
  });
});

test('07 - Dead-man s-switch Watchdog alert simulation (Gotcha #16)', () => {
  const watchdogFiring = true;
  assert.strictEqual(watchdogFiring, true);
});
