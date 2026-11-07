/**
 * Module 11: health colours, allocation explanations (same-shard, disk, filters, tiers,
 * awareness), disk watermarks and the flood-stage block, heap sizing, incremental
 * snapshots and SLM retention, and the 8 -> 9 upgrade path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  indexHealth,
  clusterHealth,
  explain,
  diskAction,
  floodBlockAfter,
  recommendedHeapGb,
  usesCompressedOops,
  Repository,
  canRollingUpgrade,
  indexCompatible,
  type ShardCopy,
  type NodeInfo,
} from './lib/ops.ts';

const copy = (
  index: string,
  shard: number,
  primary: boolean,
  state: ShardCopy['state'],
): ShardCopy => ({ index, shard, primary, state });

describe('cluster health', () => {
  it('green when every copy is active', () => {
    assert.equal(
      indexHealth([copy('a', 0, true, 'STARTED'), copy('a', 0, false, 'STARTED')]),
      'green',
    );
  });

  it('yellow when a replica is unassigned: a single-node cluster with replicas: 1 is always yellow', () => {
    assert.equal(
      indexHealth([copy('a', 0, true, 'STARTED'), copy('a', 0, false, 'UNASSIGNED')]),
      'yellow',
    );
  });

  it('red when a primary is unassigned; the cluster takes the worst index colour', () => {
    const copies = [
      copy('a', 0, true, 'STARTED'),
      copy('b', 0, true, 'UNASSIGNED'),
      copy('c', 0, false, 'UNASSIGNED'),
      copy('c', 0, true, 'STARTED'),
    ];
    assert.equal(clusterHealth(copies), 'red');
    assert.equal(indexHealth(copies.filter((c) => c.index === 'a')), 'green');
  });

  it('a relocating copy is still active (health stays green while rebalancing)', () => {
    assert.equal(
      indexHealth([copy('a', 0, true, 'RELOCATING'), copy('a', 0, false, 'STARTED')]),
      'green',
    );
  });
});

describe('allocation explain', () => {
  const nodes: NodeInfo[] = [
    { name: 'n1', diskUsedPct: 40, attrs: { zone: 'a' }, roles: ['data_hot'] },
    { name: 'n2', diskUsedPct: 88, attrs: { zone: 'b' }, roles: ['data_hot'] },
    { name: 'n3', diskUsedPct: 30, attrs: { zone: 'a' }, roles: ['data_warm'] },
  ];

  it('a replica cannot go to the node holding its primary, nor to a node above the low watermark', () => {
    const d = explain({ index: 'logs', shard: 0, primary: false, holders: ['n1'] }, nodes);
    assert.match(d.find((x) => x.node === 'n1')!.reasons.join(), /same_shard/);
    assert.match(d.find((x) => x.node === 'n2')!.reasons.join(), /low watermark \[85%\]/);
    assert.equal(d.find((x) => x.node === 'n3')!.decision, 'YES');
  });

  it('tier preference keeps a hot index off warm nodes', () => {
    const d = explain(
      { index: 'logs', shard: 0, primary: false, holders: ['n1'], tierPreference: ['data_hot'] },
      nodes,
    );
    assert.match(d.find((x) => x.node === 'n3')!.reasons.join(), /data_tier/);
    assert.ok(
      d.every((x) => x.decision === 'NO'),
      'n1 holds the primary, n2 is over the low watermark: the replica stays unassigned (yellow)',
    );
  });

  it('awareness spreads copies across zones', () => {
    const d = explain(
      { index: 'logs', shard: 0, primary: false, holders: ['n1'], awareness: 'zone' },
      [nodes[0]!, { ...nodes[1]!, diskUsedPct: 10 }, nodes[2]!],
    );
    assert.match(
      d.find((x) => x.node === 'n3')!.reasons.join(),
      /awareness/,
      'n3 is in zone a like the primary',
    );
    assert.equal(d.find((x) => x.node === 'n2')!.decision, 'YES');
  });

  it('forced awareness: with zone b gone, the replica must not be placed in zone a', () => {
    const zoneA = nodes
      .filter((n) => n.attrs['zone'] === 'a')
      .map((n) => ({ ...n, roles: ['data_hot'] }));
    const plain = explain(
      { index: 'logs', shard: 0, primary: false, holders: ['n1'], awareness: 'zone' },
      zoneA,
    );
    assert.equal(
      plain.find((x) => x.node === 'n3')!.decision,
      'YES',
      'plain awareness falls back to the surviving zone',
    );
    const forced = explain(
      {
        index: 'logs',
        shard: 0,
        primary: false,
        holders: ['n1'],
        awareness: 'zone',
        forcedValues: ['a', 'b'],
      },
      zoneA,
    );
    assert.equal(forced.find((x) => x.node === 'n3')!.decision, 'NO');
  });

  it('exclude._name drains a node', () => {
    const d = explain(
      { index: 'logs', shard: 1, primary: true, holders: [], exclude: { _name: 'n1' } },
      nodes,
    );
    assert.match(d.find((x) => x.node === 'n1')!.reasons.join(), /exclude/);
  });
});

describe('disk watermarks', () => {
  it('85% low, 90% high, 95% flood stage', () => {
    assert.deepEqual(
      [50, 86, 91, 96].map((p) => diskAction(p)),
      ['none', 'no_new_shards', 'relocate_away', 'read_only_allow_delete'],
    );
  });

  it('the flood-stage block is released automatically once usage falls below the high watermark', () => {
    let blocked = floodBlockAfter(96, false);
    assert.equal(blocked, true);
    blocked = floodBlockAfter(92, blocked);
    assert.equal(blocked, true, 'still above high: stays blocked');
    blocked = floodBlockAfter(80, blocked);
    assert.equal(blocked, false);
  });
});

describe('JVM heap', () => {
  it('half of RAM, capped below the compressed-oops threshold', () => {
    assert.equal(recommendedHeapGb(16), 8);
    assert.equal(recommendedHeapGb(64), 31);
    assert.equal(recommendedHeapGb(256), 31);
  });

  it('negative: a 40 GB heap loses compressed oops and holds fewer objects than 31 GB would', () => {
    assert.equal(usesCompressedOops(31), true);
    assert.equal(usesCompressedOops(40), false);
    // 64-bit references are twice as large: a reference-heavy heap of 40 GB ~ 20-30 GB of useful capacity
  });
});

describe('snapshots', () => {
  it('are incremental at the segment-file level', () => {
    const repo = new Repository();
    assert.deepEqual(repo.snapshot('s1', ['_0.cfs', '_1.cfs'], 1), { uploaded: 2, reused: 0 });
    assert.deepEqual(repo.snapshot('s2', ['_0.cfs', '_1.cfs', '_2.cfs'], 2), {
      uploaded: 1,
      reused: 2,
    });
    // after a merge, the merged segment is new data even though no document changed
    assert.deepEqual(repo.snapshot('s3', ['_3.cfs'], 3), { uploaded: 1, reused: 0 });
  });

  it('deleting a snapshot keeps files referenced by other snapshots', () => {
    const repo = new Repository();
    repo.snapshot('s1', ['a', 'b'], 1);
    repo.snapshot('s2', ['b', 'c'], 2);
    assert.equal(repo.delete('s1'), 1, 'only a is removed');
    assert.deepEqual([...repo.blobs].sort(), ['b', 'c']);
  });

  it('SLM retention: expire after N days but keep a minimum count', () => {
    const DAY = 86400000;
    const repo = new Repository();
    for (let i = 0; i < 10; i++) repo.snapshot(`daily-${i}`, [`f${i}`], i * DAY);
    const deleted = repo.applyRetention(40 * DAY, 30 * DAY, 5, 50);
    assert.deepEqual(deleted.sort(), ['daily-0', 'daily-1', 'daily-2', 'daily-3', 'daily-4']);
    assert.equal(
      repo.snapshots.length,
      5,
      'min_count protects the newest five although all are expired',
    );
  });
});

describe('upgrades', () => {
  it('9.1+ requires starting from 8.19; 9.0 also accepts 8.18', () => {
    assert.equal(canRollingUpgrade('8.19.6', '9.5.6'), true);
    assert.equal(canRollingUpgrade('8.18.4', '9.0.3'), true);
    assert.equal(canRollingUpgrade('8.18.4', '9.5.6'), false);
    assert.equal(canRollingUpgrade('8.17.0', '9.5.6'), false);
    assert.equal(canRollingUpgrade('7.17.25', '9.5.6'), false, 'never across two majors');
    assert.equal(canRollingUpgrade('9.5.6', '9.4.9'), false, 'no downgrades');
  });

  it('indices created in 7.x must be reindexed or archived read-only before 9.x', () => {
    assert.equal(indexCompatible(8, 9), 'ok');
    assert.equal(indexCompatible(7, 9), 'read_only_archive');
    assert.equal(indexCompatible(6, 9), 'reindex_required');
  });
});
