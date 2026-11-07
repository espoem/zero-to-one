// Module 11: CRC16 hash slots, hash tags, CROSSSLOT, MOVED vs ASK routing during a migration,
// replica election delays and configEpoch-based slot ownership.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  crc16,
  hashTag,
  keySlot,
  checkSameSlot,
  FakeCluster,
  ClusterClient,
  electionDelayMs,
  resolveSlotOwner,
  SLOTS,
} from './src/cluster.ts';

test('CRC16/XMODEM check value from the spec: "123456789" -> 0x31C3', () => {
  assert.equal(crc16(Buffer.from('123456789')), 0x31c3);
});

test('hash tags follow the spec examples exactly', () => {
  const tag = (k: string) => hashTag(Buffer.from(k)).toString();
  assert.equal(tag('{user1000}.following'), 'user1000');
  assert.equal(tag('{user1000}.followers'), 'user1000');
  assert.equal(tag('foo{}{bar}'), 'foo{}{bar}'); // empty first tag: whole key hashed
  assert.equal(tag('foo{{bar}}zap'), '{bar'); // between the first { and the first } after it
  assert.equal(tag('foo{bar}{zap}'), 'bar'); // only the first tag counts
  assert.equal(tag('{}user'), '{}user'); // starts with {}: hashed as a whole
  assert.equal(keySlot('{user1000}.following'), keySlot('{user1000}.followers'));
});

test('property: slots are in range and keys sharing a non-empty tag share a slot', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !/[{}]/.test(s)),
      fc.string(),
      fc.string(),
      (t, a, b) => {
        const s1 = keySlot(`${a.replace(/[{}]/g, '')}{${t}}x`);
        const s2 = keySlot(`{${t}}${b}`);
        assert.equal(s1, s2);
        assert.ok(s1 >= 0 && s1 < SLOTS);
      },
    ),
  );
});

test('slots are roughly uniform over many keys (no hot slot by construction)', () => {
  const counts = new Array(16).fill(0);
  for (let i = 0; i < 160_000; i++) counts[keySlot(`user:${i}`) >> 10]!++; // 16 buckets of 1024 slots
  for (const c of counts) assert.ok(c > 9_000 && c < 11_000, `bucket ${c}`);
});

test('negative: multi-key operations across slots fail with CROSSSLOT; a hash tag fixes it', () => {
  assert.throws(() => checkSameSlot(['user:1', 'user:2']), /CROSSSLOT/);
  assert.doesNotThrow(() => checkSameSlot(['cart:{42}', 'cart:{42}:items']));
});

test('negative: overusing one hash tag puts all keys in one slot (one node, one hot spot)', () => {
  const slots = new Set(Array.from({ length: 10_000 }, (_, i) => keySlot(`{tenant}:order:${i}`)));
  assert.equal(slots.size, 1);
});

test('MOVED updates the client slot map; later requests go straight to the owner', () => {
  const cl = new FakeCluster(['A', 'B', 'C']);
  const client = new ClusterClient(cl, 'A');
  const key = 'user:7';
  const owner = cl.owner(keySlot(key));
  client.run('SET', key, 'v');
  assert.equal(client.cachedNode(keySlot(key)), owner === 'A' ? undefined : owner);
  const before = client.redirects.moved;
  assert.equal(client.run('GET', key), 'v');
  assert.equal(client.redirects.moved, before); // no further redirections
});

test('ASK during migration: one-off redirect with ASKING, slot map not updated; MOVED after it completes', () => {
  const cl = new FakeCluster(['A', 'B']);
  const key = 'k:{migrating}';
  const slot = keySlot(key);
  const src = cl.owner(slot);
  const dst = src === 'A' ? 'B' : 'A';
  const client = new ClusterClient(cl, src);
  client.run('SET', key, 'v');
  // Start migrating the slot and move this key.
  cl.nodes.get(src)!.migrating.set(slot, dst);
  cl.nodes.get(dst)!.importing.set(slot, src);
  cl.migrateKey(key, src, dst);
  assert.equal(client.run('GET', key), 'v');
  assert.equal(client.redirects.ask, 1);
  assert.notEqual(client.cachedNode(slot), dst); // ASK must not update the map
  // Without ASKING the importing node refuses: it redirects back with MOVED.
  assert.match(String(cl.nodes.get(dst)!.exec('GET', key)), /^MOVED/);
  // Migration finishes: ownership changes, the client gets MOVED once and caches the new owner.
  cl.assign(slot, dst);
  assert.equal(client.run('GET', key), 'v');
  assert.equal(client.cachedNode(slot), dst);
});

test('replica election delay: rank 0 (most up to date) tries first', () => {
  assert.equal(electionDelayMs(0, 0), 500);
  assert.equal(electionDelayMs(2, 0.999), 500 + 499 + 2000);
  assert.ok(electionDelayMs(0, 0.999) < electionDelayMs(1, 0));
});

test('slot ownership: the claim with the higher configEpoch wins (last failover wins)', () => {
  const cur = { node: 'old-primary', epoch: 7 };
  assert.deepEqual(resolveSlotOwner(cur, { node: 'promoted', epoch: 8 }), {
    node: 'promoted',
    epoch: 8,
  });
  assert.deepEqual(resolveSlotOwner(cur, { node: 'stale', epoch: 6 }), cur);
});
