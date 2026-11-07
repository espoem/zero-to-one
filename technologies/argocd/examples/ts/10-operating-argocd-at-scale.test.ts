import test from 'node:test';
import assert from 'node:assert';
import { calculateControllerShard } from './lib/argocd-model.js';

test('10-operating-argocd-at-scale: Controller Sharding Distribution', () => {
  const apps = ['app-1', 'app-2', 'app-3', 'app-4', 'app-5', 'app-6'];
  const shards = apps.map((app) => calculateControllerShard(app, 3));
  assert.ok(shards.every((s) => s >= 0 && s < 3));
});
