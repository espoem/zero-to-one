import test from 'node:test';
import assert from 'node:assert';
import { evaluateOpenGitOpsPrinciples } from './lib/argocd-model.js';

test('01-gitops-principles-and-architecture-comparison: OpenGitOps 4 Principles', () => {
  const result = evaluateOpenGitOpsPrinciples({
    declarative: true,
    versionedAndImmutable: true,
    pulledAutomatically: true,
    continuouslyReconciled: true,
  });
  assert.strictEqual(result.compliant, true);
  assert.strictEqual(result.score, 4);

  const partial = evaluateOpenGitOpsPrinciples({
    declarative: true,
    versionedAndImmutable: true,
    pulledAutomatically: false,
    continuouslyReconciled: true,
  });
  assert.strictEqual(partial.compliant, false);
  assert.strictEqual(partial.score, 3);
});
