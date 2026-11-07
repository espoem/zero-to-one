import test from 'node:test';
import assert from 'node:assert';
import { calculateDrift } from './lib/argocd-model.js';

test('05-drift-reconciliation-and-app-of-apps: Drift Calculation with ignoreDifferences', () => {
  const desired = { spec: { replicas: 3, image: 'nginx:1.25' } };
  const live = { spec: { replicas: 5, image: 'nginx:1.25' } }; // HPA changed replicas

  // Without ignoreDifferences
  const drift1 = calculateDrift(desired, live, []);
  assert.strictEqual(drift1.isOutOfSync, true);

  // With ignoreDifferences for /spec/replicas
  const drift2 = calculateDrift(desired, live, ['/spec/replicas']);
  assert.strictEqual(drift2.isOutOfSync, false);
});
