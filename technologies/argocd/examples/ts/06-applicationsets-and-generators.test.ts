import test from 'node:test';
import assert from 'node:assert';
import { evaluateMatrixGenerator } from './lib/argocd-model.js';

test('06-applicationsets-and-generators: ApplicationSet Matrix Cartesian Product', () => {
  const clusters = [{ name: 'cluster-a' }, { name: 'cluster-b' }];
  const regions = [{ name: 'us-east-1' }, { name: 'eu-west-1' }];
  const matrix = evaluateMatrixGenerator(clusters, regions);
  assert.strictEqual(matrix.length, 4);
  assert.deepStrictEqual(matrix[0], { cluster: 'cluster-a', region: 'us-east-1' });
});
