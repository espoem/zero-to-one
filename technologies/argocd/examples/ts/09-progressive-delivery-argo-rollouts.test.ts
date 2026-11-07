import test from 'node:test';
import assert from 'node:assert';
import { evaluateRolloutStep } from './lib/argocd-model.js';

test('09-progressive-delivery-argo-rollouts: Argo Rollouts Step Evaluation', () => {
  const step1 = evaluateRolloutStep(10, 20, 'Successful');
  assert.strictEqual(step1.nextWeight, 20);
  assert.strictEqual(step1.status, 'Progressing');

  const failed = evaluateRolloutStep(20, 40, 'Failed');
  assert.strictEqual(failed.status, 'Aborted');
  assert.strictEqual(failed.nextWeight, 0);
});
