import test from 'node:test';
import assert from 'node:assert';
import { sortSyncWaveItems } from './lib/argocd-model.js';

test('04-sync-waves-hooks-and-health: Sync Waves & Phase Sorting', () => {
  const items = [
    { kind: 'Deployment', name: 'app', wave: 0, phase: 'Sync' as const },
    { kind: 'CustomResourceDefinition', name: 'crd', wave: -1, phase: 'PreSync' as const },
    { kind: 'Job', name: 'migration', wave: -1, phase: 'PreSync' as const },
  ];
  const sorted = sortSyncWaveItems(items);
  assert.strictEqual(sorted[0].name, 'crd');
  assert.strictEqual(sorted[1].name, 'migration');
  assert.strictEqual(sorted[2].name, 'app');
});
