import test from 'node:test';
import assert from 'node:assert';
import { resolveMultiSourceValues } from './lib/argocd-model.js';

test('03-applications-and-manifest-sources: Multi-Source Values Resolution', () => {
  const sources = [
    { repoURL: 'https://github.com/org/values-repo', path: 'envs/prod/values.yaml', ref: 'vals' },
  ];
  const template = 'replicaCount: 3\nconfigFrom: $vals/values.yaml';
  const resolved = resolveMultiSourceValues(sources, template);
  assert.ok(resolved.includes('resolved-from-envs/prod/values.yaml'));
});
