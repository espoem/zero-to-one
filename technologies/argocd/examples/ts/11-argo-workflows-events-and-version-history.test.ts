import test from 'node:test';
import assert from 'node:assert';
import { evaluateDAGTopologicalSort } from './lib/argocd-model.js';

test('11-argo-workflows-events-and-version-history: Workflows DAG Topological Sort', () => {
  const tasks = [
    { name: 'build', dependencies: [] },
    { name: 'test', dependencies: ['build'] },
    { name: 'deploy', dependencies: ['test'] },
  ];
  const sorted = evaluateDAGTopologicalSort(tasks);
  assert.deepStrictEqual(sorted, ['build', 'test', 'deploy']);
});
