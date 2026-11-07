/**
 * Module 10: document routing is murmur3(UTF-16LE(_routing)) mod routing shards, checked
 * against Elasticsearch's own published hash values; why the primary count is fixed; what
 * _split and _shrink allow; custom routing hot spots and routing_partition_size; shard
 * sizing arithmetic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  murmur3x86_32,
  esRoutingHash,
  shardId,
  legacyShardId,
  defaultRoutingShards,
  canSplit,
  canShrink,
  partitionedShardId,
  floorMod,
} from './lib/routing.ts';
import { Index } from './lib/search.ts';

describe('murmur3 routing hash', () => {
  it('matches the reference MurmurHash3_x86_32 vectors on UTF-8 bytes', () => {
    const h = (s: string, seed = 0) =>
      murmur3x86_32(new Uint8Array(Buffer.from(s, 'utf8')), seed) >>> 0;
    assert.equal(h(''), 0);
    assert.equal(h('', 1), 0x514e28b7);
    assert.equal(h('hello'), 0x248bfa47);
    assert.equal(h('The quick brown fox jumps over the lazy dog'), 0x2e4ff723);
  });

  it('matches Elasticsearch Murmur3HashFunctionTests (UTF-16LE encoding of the routing string)', () => {
    const known: [string, number][] = [
      ['hell', 0x5a0cb7c3],
      ['hello', 0xd7c31989],
      ['hello w', 0x22ab2984],
      ['hello wo', 0xdf0ca123],
      ['hello wor', 0xe7744d61],
      ['The quick brown fox jumps over the lazy dog', 0xe07db09c],
      ['The quick brown fox jumps over the lazy cog', 0x4e63d2ad],
    ];
    for (const [s, v] of known) assert.equal(esRoutingHash(s) >>> 0, v, s);
  });

  it('reproduces routing: _id "654321" in a 6-shard index lands on shard 2 in ES 9+ (shard 4 in legacy ES 7/8)', () => {
    assert.equal(esRoutingHash('654321'), 1424940152);
    // ES 9+ modulo routing (IndexVersions.MOD_ROUTING_FUNCTION):
    assert.equal(shardId('654321', 6), 2);
    // Legacy ES 7.x/8.x routing shards formula:
    assert.equal(defaultRoutingShards(6), 768);
    assert.equal(floorMod(1424940152, 768), 632);
    assert.equal(legacyShardId('654321', 6), 4);
  });

  it('floorMod keeps negative hashes in range (Java % would not)', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 64 }), (s, n) => {
        const sh = shardId(s, n);
        return sh >= 0 && sh < n;
      }),
    );
  });
});

describe('number_of_routing_shards', () => {
  it('defaults to the largest power-of-two multiple of the primary count <= 1024', () => {
    assert.deepEqual(
      [1, 2, 3, 5, 6, 512, 600].map(defaultRoutingShards),
      [1024, 1024, 768, 640, 768, 1024, 600],
    );
  });

  it('_split: target must be a multiple of the source and divide the routing shards', () => {
    assert.equal(canSplit(6, 12, 768), true);
    assert.equal(canSplit(6, 18, 768), false, '768 is not divisible by 18');
    assert.equal(canSplit(5, 7, 640), false);
  });

  it('_shrink: target must be a factor of the source', () => {
    assert.equal(canShrink(12, 4), true);
    assert.equal(canShrink(12, 5), false);
  });

  it('split preserves co-location: every document of a source shard maps to one of its child shards', () => {
    // ES 9+ modulo routing: target shard j splits from source shard (j % sourceShards)
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const before = shardId(id, 6);
        const after = shardId(id, 12);
        return after % 6 === before;
      }),
    );
    // Legacy ES 7/8 routing: target shard j splits from source shard floor(j / routingFactor)
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const before = legacyShardId(id, 6, 768);
        const after = legacyShardId(id, 12, 768);
        return Math.floor(after / 2) === before;
      }),
    );
  });

  it('negative: naively changing the primary count (new index, same routing shards formula) moves most documents', () => {
    let moved = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (shardId(`doc-${i}`, 5) !== shardId(`doc-${i}`, 6)) moved++;
    assert.ok(moved / n > 0.6, `${moved} of ${n} moved`);
  });
});

describe('custom routing', () => {
  it('default routing by _id spreads documents evenly', () => {
    const counts = new Array(5).fill(0) as number[];
    for (let i = 0; i < 10000; i++) counts[shardId(`order-${i}`, 5)]!++;
    for (const c of counts) assert.ok(Math.abs(c - 2000) < 200, String(counts));
  });

  it('negative: routing by tenant puts a large tenant on one shard (hot spot)', () => {
    const counts = new Array(5).fill(0) as number[];
    for (let i = 0; i < 10000; i++)
      counts[shardId(i < 8000 ? 'tenant-big' : `tenant-${i % 50}`, 5)]!++;
    assert.ok(Math.max(...counts) >= 8000);
  });

  it('routing_partition_size spreads one routing value over a subset of shards', () => {
    const shards = new Set<number>();
    for (let i = 0; i < 2000; i++) shards.add(partitionedShardId('tenant-big', `doc-${i}`, 20, 4));
    assert.ok(shards.size > 1 && shards.size <= 4, `used ${shards.size} shards`);
  });

  it('negative: GET with a different routing value than at index time misses the document', () => {
    const idx = new Index('t', { properties: {} }, { number_of_shards: 8 });
    idx.index('o1', { a: 1 }, { routing: 'tenant-a' });
    let other = 'tenant-b';
    for (let i = 0; idx.shardFor('o1', other) === idx.shardFor('o1', 'tenant-a'); i++)
      other = `tenant-${i}`;
    assert.equal(idx.get('o1', 'tenant-a').found, true);
    assert.equal(idx.get('o1', other).found, false);
    assert.equal(idx.get('o1').found, idx.shardFor('o1') === idx.shardFor('o1', 'tenant-a'));
  });

  it('a search with ?routing hits one shard instead of all', () => {
    const idx = new Index('t', { properties: {} }, { number_of_shards: 8 });
    const touched = new Set([idx.shardFor('x', 'tenant-a'), idx.shardFor('y', 'tenant-a')]);
    assert.equal(touched.size, 1);
  });
});

describe('shard sizing arithmetic', () => {
  /** Primaries so each shard stays at or below the target size, given growth until rollover. */
  const primariesFor = (indexSizeGb: number, targetShardGb = 40) =>
    Math.max(1, Math.ceil(indexSizeGb / targetShardGb));

  it('aims for 10-50 GB shards', () => {
    assert.equal(primariesFor(5), 1);
    assert.equal(primariesFor(400), 10);
  });

  it('negative: daily indices of 1 GB with 5 primaries and 1 replica x 365 days = 3650 tiny shards', () => {
    const shards = 365 * 5 * 2;
    assert.equal(shards, 3650);
    assert.ok(1 / 5 < 1, 'each shard holds 200 MB: far below the sweet spot');
  });
});
