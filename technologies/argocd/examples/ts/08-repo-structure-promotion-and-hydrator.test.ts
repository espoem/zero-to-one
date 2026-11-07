import test from 'node:test';
import assert from 'node:assert';
import { validateEnvironmentPromotion } from './lib/argocd-model.js';

test('08-repo-structure-promotion-and-hydrator: Environment Promotion Gates', () => {
  const p1 = validateEnvironmentPromotion('dev', 'staging', 'sha-abc');
  assert.strictEqual(p1.promoted, true);

  const p2 = validateEnvironmentPromotion('dev', 'prod', 'sha-abc');
  assert.strictEqual(p2.promoted, false);
});
