/**
 * Verification for the Domain 5 (Distributed Datastore) hands-on tasks of exams/elastic-certified-engineer.md:
 * Q-ECE-045, 047. The routing arithmetic is also proved offline in ../13-exam-reference-answers.test.ts.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, wipe, total, type Rest } from './exam-helpers.ts';
import { shardId } from '../lib/routing.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
before(async () => ({ r, skip } = await setup()));
after(async () => {
  if (r) await wipe(r, { indices: ['nrt', 'orders'] });
});

describe('Domain 5: Distributed Datastore (hands-on)', () => {
  it('Q-ECE-045: search is near-real-time, GET is realtime, refresh=wait_for blocks until visible', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['nrt'] });
    await r!.call('PUT', '/nrt', {
      settings: { number_of_shards: 1, number_of_replicas: 0, refresh_interval: '30s' },
    });
    await r!.call('PUT', '/nrt/_doc/1', { t: 'a' });
    assert.equal(total(await r!.call('GET', '/nrt/_search')), 0);
    assert.equal((await r!.call('GET', '/nrt/_doc/1')).found, true);
    await r!.call('POST', '/nrt/_refresh');
    assert.equal(total(await r!.call('GET', '/nrt/_search')), 1);
    // blocks until the next scheduled refresh (up to 30 s) has made the document visible
    await r!.call('PUT', '/nrt/_doc/2', { t: 'b' }, { refresh: 'wait_for' });
    assert.equal(total(await r!.call('GET', '/nrt/_search')), 2);
  });

  it('Q-ECE-047: murmur3 routing to shard 2, custom routing on get, routed search touches one shard', async (t) => {
    if (skip) return t.skip(skip);
    await wipe(r!, { indices: ['orders'] });
    await r!.call('PUT', '/orders', {
      settings: { number_of_shards: 6, number_of_replicas: 0 },
      mappings: { properties: { tenant: { type: 'keyword' } } },
    });
    const sh = await r!.call('GET', '/orders/_search_shards', undefined, { routing: '654321' });
    assert.equal(sh.shards.length, 1);
    assert.equal(sh.shards[0][0].shard, 2);
    assert.equal(sh.shards[0][0].shard, shardId('654321', 6));

    await r!.call(
      'PUT',
      '/orders/_doc/o-1001',
      { tenant: 'tenant-42', total: 99 },
      { routing: 'tenant-42', refresh: 'true' },
    );
    // without routing the GET goes to the shard of the id; it misses unless the two values share a shard
    if (shardId('o-1001', 6) !== shardId('tenant-42', 6))
      await r!.fails('GET', '/orders/_doc/o-1001', undefined, 404);
    const found = await r!.call('GET', '/orders/_doc/o-1001', undefined, { routing: 'tenant-42' });
    assert.equal(found.found, true);
    const res = await r!.call(
      'GET',
      '/orders/_search',
      { query: { term: { tenant: 'tenant-42' } } },
      { routing: 'tenant-42' },
    );
    assert.equal(res._shards.total, 1);
    assert.equal(total(res), 1);
  });
});
