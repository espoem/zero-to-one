/**
 * Module 02: near-real-time search (refresh), realtime GET, translog durability and crash
 * recovery, flush, segment merges and deletes, point-in-time readers, optimistic
 * concurrency with _seq_no/_primary_term, per-shard scoring skew vs DFS, and the
 * equivalence of batched (per-node) and per-shard query-phase reduction.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { Shard, VersionConflictError } from './lib/lucene.ts';
import { Index, searchShard } from './lib/search.ts';
import type { Mapping } from './lib/mapping.ts';

const mapping: Mapping = { properties: { body: { type: 'text' }, n: { type: 'long' } } };

describe('near-real-time search', () => {
  it('a document is not searchable until refresh, but GET by id is realtime', () => {
    const s = new Shard({ mapping });
    s.index('a', { body: 'hello world' });
    assert.equal(
      searchShard(s, { match: { body: 'hello' } }).length,
      0,
      'not visible to search yet',
    );
    assert.equal(s.get('a').found, true, 'realtime GET reads the version map / translog');
    s.refresh();
    assert.equal(searchShard(s, { match: { body: 'hello' } }).length, 1);
  });

  it('every refresh that has buffered docs creates a new segment', () => {
    const s = new Shard({ mapping });
    for (let i = 0; i < 5; i++) {
      s.index(String(i), { body: `doc ${i}` });
      s.refresh();
    }
    assert.equal(s.segments.length, 5);
    s.refresh(); // empty buffer: no new segment
    assert.equal(s.segments.length, 5);
  });

  it('refresh_interval -1 during a bulk load produces one segment instead of thousands', () => {
    const every = new Shard({ mapping });
    const disabled = new Shard({ mapping });
    for (let i = 0; i < 200; i++) {
      every.index(String(i), { body: `x ${i}` });
      every.refresh(); // like a 1s interval under steady ingest
      disabled.index(String(i), { body: `x ${i}` });
    }
    disabled.refresh();
    assert.equal(every.segments.length, 200);
    assert.equal(disabled.segments.length, 1);
  });
});

describe('durability: translog, flush and crash recovery', () => {
  it('request durability: acknowledged but unflushed writes survive a crash via translog replay', () => {
    const s = new Shard({ mapping });
    s.index('1', { body: 'committed' });
    s.flush();
    s.index('2', { body: 'only in translog' });
    s.delete('1');
    const r = s.crashAndRecover();
    assert.equal(r.get('1').found, false);
    assert.equal(r.get('2').found, true);
    assert.equal(searchShard(r, { match: { body: 'translog' } }).length, 1);
  });

  it('negative: async durability can lose acknowledged writes from the last sync interval', () => {
    const s = new Shard({ mapping, durability: 'async' });
    s.index('1', { body: 'synced' });
    s.syncTranslog(); // the 5s timer fired
    s.index('2', { body: 'acknowledged, not yet fsynced' });
    const r = s.crashAndRecover();
    assert.equal(r.get('1').found, true);
    assert.equal(r.get('2').found, false, 'lost: ack happened before the fsync');
  });

  it('flush trims the translog (recovery replays less)', () => {
    const s = new Shard({ mapping });
    for (let i = 0; i < 10; i++) s.index(String(i), { body: 'x' });
    assert.equal(s.translog.length, 10);
    s.flush();
    assert.equal(s.translog.length, 0);
    assert.equal(s.crashAndRecover().get('9').found, true);
  });
});

describe('segments, deletes and merges', () => {
  it('an update is delete + insert: the old copy stays as a deleted doc until merged', () => {
    const s = new Shard({ mapping });
    s.index('a', { body: 'v1' });
    s.refresh();
    s.index('a', { body: 'v2' });
    s.refresh();
    const total = s.segments.reduce((n, seg) => n + seg.maxDoc, 0);
    const deleted = s.segments.reduce((n, seg) => n + seg.deletedDocs, 0);
    assert.equal(total, 2);
    assert.equal(deleted, 1);
    s.forceMerge(1);
    assert.equal(s.segments.length, 1);
    assert.equal(s.segments[0]!.maxDoc, 1);
    assert.equal(s.segments[0]!.deletedDocs, 0);
  });

  it('deleted docs still inflate docFreq (and so change scores) until a merge', () => {
    const s = new Shard({ mapping });
    s.index('keep', { body: 'rare term' });
    for (let i = 0; i < 5; i++) s.index(`x${i}`, { body: 'other words here' });
    s.refresh();
    const before = searchShard(s, { match: { body: 'rare' } })[0]!.score;
    for (let i = 0; i < 5; i++) s.index(`x${i}`, { body: 'rare words here' });
    s.refresh(); // the new versions are now in their own segment
    for (let i = 0; i < 5; i++) s.delete(`x${i}`);
    s.refresh();
    const withTombstones = searchShard(s, { match: { body: 'rare' } });
    assert.equal(withTombstones.length, 1, 'deleted docs never match');
    assert.notEqual(withTombstones[0]!.score, before, 'but they still count in N and n');
    s.forceMerge(1);
    assert.equal(
      searchShard(s, { match: { body: 'rare' } })[0]!.score.toFixed(12),
      searchShard(freshShard(), { match: { body: 'rare' } })[0]!.score.toFixed(12),
    );
  });

  it('a tiered-style merge policy bounds the segment count', () => {
    const s = new Shard({ mapping });
    for (let i = 0; i < 25; i++) {
      s.index(String(i), { body: 'x' });
      s.refresh();
      s.maybeMerge(10, 10);
    }
    assert.ok(s.segments.length <= 10);
    assert.equal(
      s.segments.reduce((n, seg) => n + seg.numDocs, 0),
      25,
    );
  });

  it('segments with more than 20% deleted docs are merged away first', () => {
    const s = new Shard({ mapping });
    for (let i = 0; i < 10; i++) s.index(String(i), { body: 'x' });
    s.refresh();
    for (let i = 0; i < 3; i++) s.delete(String(i));
    const merged = s.maybeMerge();
    assert.ok(merged);
    assert.equal(merged.deletedDocs, 0);
    assert.equal(merged.numDocs, 7);
  });

  it('an open point-in-time reader keeps seeing the old view after deletes and refreshes', () => {
    const s = new Shard({ mapping });
    s.index('a', { body: 'alpha' });
    s.refresh();
    const pit = s.reader();
    s.delete('a');
    s.index('b', { body: 'alpha' });
    s.refresh();
    assert.deepEqual(
      pit.segments.flatMap((seg) => seg.ids.filter((_, d) => seg.live[d])),
      ['a'],
    );
    assert.deepEqual(
      searchShard(s, { match: { body: 'alpha' } }).map((h) => h.id),
      ['b'],
    );
  });
});

describe('optimistic concurrency control', () => {
  it('if_seq_no / if_primary_term reject a stale write', () => {
    const s = new Shard({ mapping });
    const v1 = s.index('doc', { n: 1 });
    s.index('doc', { n: 2 }, { ifSeqNo: v1._seq_no, ifPrimaryTerm: v1._primary_term });
    assert.throws(
      () => s.index('doc', { n: 3 }, { ifSeqNo: v1._seq_no, ifPrimaryTerm: v1._primary_term }),
      VersionConflictError,
    );
  });

  it('op_type=create fails if the id exists', () => {
    const s = new Shard({ mapping });
    s.index('doc', { n: 1 }, { opType: 'create' });
    assert.throws(() => s.index('doc', { n: 1 }, { opType: 'create' }), /document already exists/);
  });

  it('sequence numbers are dense and monotonic per shard (deletes consume one too)', () => {
    const s = new Shard({ mapping });
    const a = s.index('a', { n: 1 });
    const d = s.delete('a');
    const b = s.index('b', { n: 1 });
    assert.deepEqual([a._seq_no, d._seq_no, b._seq_no], [0, 1, 2]);
    assert.equal(s.localCheckpoint, 2);
  });
});

describe('distributed scoring: query_then_fetch vs dfs_query_then_fetch', () => {
  function skewed(): Index {
    // custom routing puts all "noise" documents on one shard
    const idx = new Index('t', mapping, { number_of_shards: 2 });
    const shardA = idx.shardFor('a');
    const otherRouting = ['r0', 'r1', 'r2', 'r3', 'r4'].find(
      (r) => idx.shardFor('x', r) !== shardA,
    )!;
    idx.index('a', { body: 'elastic' });
    idx.index('b', { body: 'elastic' }, { routing: otherRouting });
    for (let i = 0; i < 20; i++)
      idx.index(`n${i}`, { body: 'elastic noise filler words' }, { routing: otherRouting });
    idx.refresh();
    return idx;
  }

  it('negative: two identical documents get different scores on different shards', () => {
    const res = skewed().search({ query: { match: { body: 'elastic' } }, size: 30 });
    const a = res.hits.hits.find((h) => h._id === 'a')!;
    const b = res.hits.hits.find((h) => h._id === 'b')!;
    assert.notEqual(a._shard, b._shard);
    assert.notEqual(a._score, b._score);
  });

  it('dfs_query_then_fetch uses global statistics so identical documents tie', () => {
    const res = skewed().search(
      { query: { match: { body: 'elastic' } }, size: 30 },
      'dfs_query_then_fetch',
    );
    const a = res.hits.hits.find((h) => h._id === 'a')!;
    const b = res.hits.hits.find((h) => h._id === 'b')!;
    assert.equal(a._score, b._score);
  });
});

describe('coordinating-node reduce', () => {
  type ShardHit = { id: string; score: number; shard: number };
  const topK = (hits: ShardHit[], k: number) =>
    [...hits]
      .sort((x, y) => y.score - x.score || x.shard - y.shard || x.id.localeCompare(y.id))
      .slice(0, k);

  it('batched query phase (partial reduce per data node) returns the same top-k as per-shard reduce', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer({ min: 0, max: 1000 }), { maxLength: 30 }), {
          minLength: 1,
          maxLength: 12,
        }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 20 }),
        (shardScores, nodes, k) => {
          const perShard: ShardHit[][] = shardScores.map((ss, shard) =>
            topK(
              ss.map((score, i) => ({ id: `${shard}-${i}`, score, shard })),
              k,
            ),
          );
          const flat = topK(perShard.flat(), k);
          const byNode = new Map<number, ShardHit[]>();
          perShard.forEach((hits, shard) =>
            byNode.set(shard % nodes, [...(byNode.get(shard % nodes) ?? []), ...hits]),
          );
          const batched = topK(
            [...byNode.values()].flatMap((hits) => topK(hits, k)),
            k,
          );
          return JSON.stringify(flat) === JSON.stringify(batched);
        },
      ),
    );
  });
});

function freshShard(): Shard {
  const s = new Shard({ mapping });
  s.index('keep', { body: 'rare term' });
  for (let i = 0; i < 5; i++) s.index(`x${i}`, { body: 'other words here' });
  for (let i = 0; i < 5; i++) s.delete(`x${i}`);
  s.forceMerge(1);
  return s;
}
