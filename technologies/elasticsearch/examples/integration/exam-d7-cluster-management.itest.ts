/**
 * Verification for the Domain 7 (Cluster Management) hands-on tasks of exams/elastic-certified-engineer.md:
 * Q-ECE-061, 063, 065, 066.
 * 061, 065 need the single-node lab, 063 the secured lab (compose.secure.yml, ES_PASSWORD), 066 the 3-node lab (ES_NODES=3).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  setup,
  setupSecure,
  clientAs,
  rest,
  wipe,
  eventually,
  loadProducts,
  total,
  type Rest,
  type J,
} from './exam-helpers.ts';
import { ES_NODES } from './cluster.ts';

let r: Rest | null = null;
let skip: string | false = 'not connected yet';
let sr: Rest | null = null;
let secureSkip: string | false = 'not connected yet';
before(async () => {
  ({ r, skip } = await setup());
  ({ r: sr, skip: secureSkip } = await setupSecure());
});
after(async () => {
  if (r) await wipe(r, { indices: ['products', 'restored-products', 'y', 'ha'] });
  if (sr) await wipe(sr, { indices: ['orders-1'] });
});

describe('Domain 7: Cluster Management (hands-on)', () => {
  it('Q-ECE-061: fs repository, snapshot, delete, restore under a new name', async (t) => {
    if (skip) return t.skip(skip);
    const nodes = await r!.call('GET', '/_nodes/settings', undefined, {
      filter_path: 'nodes.*.settings.path.repo',
    });
    const nodesObj = (nodes?.nodes ?? {}) as Record<string, J>;
    const configured = Object.values(nodesObj)[0]?.settings?.path?.repo as
      | string
      | string[]
      | undefined;
    const pathRepo = Array.isArray(configured) ? configured[0] : configured;
    if (!pathRepo)
      return t.skip('path.repo is not set on the node; use docker-compose.yml, which sets it');
    await loadProducts(r!);
    await wipe(r!, { indices: ['restored-products'] });
    await r!.tryCall('DELETE', '/_snapshot/repo/snap-1');
    await r!.call('PUT', '/_snapshot/repo', {
      type: 'fs',
      settings: { location: `${pathRepo}/repo` },
    });
    try {
      const snap = await r!.call(
        'PUT',
        '/_snapshot/repo/snap-1',
        { indices: 'products', include_global_state: false },
        { wait_for_completion: true },
      );
      assert.equal(snap.snapshot.state, 'SUCCESS');
      assert.equal(snap.snapshot.shards.failed, 0);
      await r!.call('DELETE', '/products');
      await r!.call('POST', '/_snapshot/repo/snap-1/_restore', {
        indices: 'products',
        rename_pattern: '(.+)',
        rename_replacement: 'restored-$1',
        index_settings: { 'index.number_of_replicas': 0 },
      });
      await r!.call('GET', '/_cluster/health/restored-products', undefined, {
        wait_for_status: 'green',
        timeout: '60s',
      });
      assert.equal((await r!.call('GET', '/restored-products/_count')).count, 7);
      const info = await r!.call('GET', '/_snapshot/repo/snap-1');
      assert.ok(info.snapshots[0].indices.includes('products'));
    } finally {
      await r!.tryCall('DELETE', '/_snapshot/repo/snap-1');
      await r!.tryCall('DELETE', '/_snapshot/repo');
    }
  });

  it('Q-ECE-063: document- and field-level security for a read-only reporting user', async (t) => {
    if (secureSkip) return t.skip(secureSkip);
    await wipe(sr!, { indices: ['orders-1'] });
    await sr!.call('PUT', '/orders-1', {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: { properties: { tenant: { type: 'keyword' } } },
    });
    await sr!.call('PUT', '/orders-1/_doc/1', {
      tenant: 'tenant-42',
      customer: { email: 'a@example.com', name: 'A' },
      total: 99,
    });
    await sr!.call(
      'PUT',
      '/orders-1/_doc/2',
      { tenant: 'tenant-7', customer: { email: 'b@example.com', name: 'B' }, total: 5 },
      { refresh: 'true' },
    );
    await sr!.call('POST', '/_security/role/orders_reader', {
      cluster: ['monitor'],
      indices: [
        {
          names: ['orders-*'],
          privileges: ['read', 'view_index_metadata'],
          query: { term: { tenant: 'tenant-42' } },
          field_security: { grant: ['*'], except: ['customer.email'] },
        },
      ],
    });
    const password = randomUUID();
    await sr!.call('POST', '/_security/user/report-bot', { password, roles: ['orders_reader'] });
    try {
      const bot = rest(clientAs({ username: 'report-bot', password }));
      const res = await bot.call('GET', '/orders-1/_search');
      assert.equal(total(res), 1);
      assert.deepEqual(res.hits.hits[0]._source.customer, { name: 'A' });
      await bot.fails('PUT', '/orders-1/_doc/9', { total: 1 }, 403, /security_exception/);
      const who = await bot.call('GET', '/_security/_authenticate');
      assert.deepEqual(who.roles, ['orders_reader']);
    } finally {
      await sr!.tryCall('DELETE', '/_security/user/report-bot');
      await sr!.tryCall('DELETE', '/_security/role/orders_reader');
    }
  });

  it('Q-ECE-065: a single node with one replica is yellow; the same_shard decider explains why', async (t) => {
    if (skip) return t.skip(skip);
    if (ES_NODES !== 1) return t.skip('needs the single-node lab (ES_NODES=1)');
    await wipe(r!, { indices: ['y'] });
    await r!.call('PUT', '/y', { settings: { number_of_replicas: 1 } });
    const health = await r!.call('GET', '/_cluster/health/y', undefined, {
      wait_for_status: 'yellow',
      timeout: '30s',
    });
    assert.equal(health.status, 'yellow');
    assert.equal(health.unassigned_shards, 1);
    const shards = (await r!.call('GET', '/_cat/shards/y', undefined, {
      format: 'json',
      h: 'index,shard,prirep,state,unassigned.reason',
    })) as J[];
    assert.equal(shards.find((s) => s.prirep === 'p')?.state, 'STARTED');
    assert.equal(shards.find((s) => s.prirep === 'r')?.state, 'UNASSIGNED');
    const ex = await r!.call('GET', '/_cluster/allocation/explain', {
      index: 'y',
      shard: 0,
      primary: false,
    });
    const deciders = (ex.node_allocation_decisions as J[]).flatMap((n) => n.deciders ?? []) as J[];
    assert.ok(
      deciders.some((d) => d.decider === 'same_shard' && d.decision === 'NO'),
      JSON.stringify(deciders),
    );
    await r!.call('PUT', '/y/_settings', { 'index.number_of_replicas': 0 });
    assert.equal(
      (
        await r!.call('GET', '/_cluster/health/y', undefined, {
          wait_for_status: 'green',
          timeout: '30s',
        })
      ).status,
      'green',
    );
  });

  it('Q-ECE-066: forced zone awareness keeps the replica out of the surviving zone', async (t) => {
    if (skip) return t.skip(skip);
    if (ES_NODES !== 3)
      return t.skip(
        'needs the 3-node lab: docker compose -f compose.3node.yml up -d --wait, ES_URL=http://localhost:9201 ES_NODES=3',
      );
    const labDir = join(import.meta.dirname, '..', '..');
    const compose = (...args: string[]): void => {
      execFileSync('docker', ['compose', '-f', 'compose.3node.yml', ...args], {
        cwd: labDir,
        stdio: 'ignore',
        timeout: 120_000,
      });
    };
    await wipe(r!, { indices: ['ha'] });
    await r!.call('PUT', '/_cluster/settings', {
      persistent: {
        'cluster.routing.allocation.awareness.attributes': 'zone',
        'cluster.routing.allocation.awareness.force.zone.values': 'zone-a,zone-b',
      },
    });
    try {
      await r!.call('PUT', '/ha', {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          'index.unassigned.node_left.delayed_timeout': '0',
        },
      });
      await r!.call('GET', '/_cluster/health/ha', undefined, {
        wait_for_status: 'green',
        timeout: '60s',
      });
      const copies = (await r!.call('GET', '/_cat/shards/ha', undefined, {
        format: 'json',
        h: 'prirep,node',
      })) as J[];
      const zoneOf = (n: string): string => (n === 'es2' ? 'zone-b' : 'zone-a');
      assert.equal(new Set(copies.map((c) => zoneOf(c.node))).size, 2, JSON.stringify(copies));
      assert.ok(copies.some((c) => c.node === 'es2'));

      compose('stop', 'es2');
      const health = await eventually(async () => {
        const h = await r!.call('GET', '/_cluster/health/ha');
        return h.status === 'yellow' && h.unassigned_shards === 1 ? h : false;
      }, 'ha to be yellow with one unassigned replica');
      assert.equal(health.unassigned_shards, 1);
      const ex = await r!.call('GET', '/_cluster/allocation/explain', {
        index: 'ha',
        shard: 0,
        primary: false,
      });
      assert.match(JSON.stringify(ex), /awareness/);
    } finally {
      try {
        compose('start', 'es2');
      } catch {
        /* the node may already be running */
      }
      await r!.tryCall('PUT', '/_cluster/settings', {
        persistent: {
          'cluster.routing.allocation.awareness.attributes': null,
          'cluster.routing.allocation.awareness.force.zone.values': null,
        },
      });
      await r!.tryCall('DELETE', '/ha');
    }
  });
});
