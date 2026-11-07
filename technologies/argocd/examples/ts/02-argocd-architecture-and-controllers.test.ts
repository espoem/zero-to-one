import test from 'node:test';
import assert from 'node:assert';
import { generateRepoServerCacheKey, calculateControllerShard } from './lib/argocd-model.js';

test('02-argocd-architecture-and-controllers: Repo-Server Cache Key & Sharding', () => {
  const cacheKey = generateRepoServerCacheKey('https://github.com/org/repo', 'HEAD', 'apps/prod');
  assert.strictEqual(cacheKey, 'repo:https://github.com/org/repo:HEAD:apps/prod');

  const shard1 = calculateControllerShard('guestbook', 3);
  const shard2 = calculateControllerShard('guestbook', 3);
  assert.strictEqual(shard1, shard2);
  assert.ok(shard1 >= 0 && shard1 < 3);
});
