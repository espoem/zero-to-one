import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CentralKVStore } from './lib/edge-models.ts';

describe('Module 04 & 05: Workers KV Eventual Consistency & Caching Dynamics', () => {
  it('serves reads from edge cache and hits central store on initial miss', async () => {
    const central = new CentralKVStore<string>();
    const prgPoP = central.createPoP('PRG-Prague', 60_000);

    central.put('user:101', 'Martin', { tier: 'enterprise' });

    // First read: edge cache miss -> central hit
    const read1 = await prgPoP.get('user:101');
    assert.equal(read1.value, 'Martin');
    assert.equal(read1.hit, 'central');

    // Second read: edge cache hit
    const read2 = await prgPoP.get('user:101');
    assert.equal(read2.value, 'Martin');
    assert.equal(read2.hit, 'edge-cache');
  });

  it('demonstrates eventual consistency lag and stale reads across geographically separated PoPs', async () => {
    const central = new CentralKVStore<string>();
    const fraPoP = central.createPoP('FRA-Frankfurt', 60_000);
    const nrtPoP = central.createPoP('NRT-Tokyo', 60_000);

    // Initial state
    central.put('config:maintenance', 'false');

    // Both PoPs cache 'false'
    await fraPoP.get('config:maintenance');
    await nrtPoP.get('config:maintenance');

    // Update occurs at central store
    central.put('config:maintenance', 'true');

    // Frankfurt PoP invalidates cache (e.g. via direct write/purge), Tokyo has NOT expired TTL yet
    fraPoP.evict('config:maintenance');

    const fraRead = await fraPoP.get('config:maintenance');
    const nrtRead = await nrtPoP.get('config:maintenance');

    assert.equal(fraRead.value, 'true'); // Fresh read from central
    assert.equal(fraRead.hit, 'central');

    assert.equal(nrtRead.value, 'false'); // Stale read served from Tokyo edge cache!
    assert.equal(nrtRead.hit, 'edge-cache');
  });

  it('simulates negative-lookup caching where missing keys are cached as null', async () => {
    const central = new CentralKVStore<string>();
    const lhrPoP = central.createPoP('LHR-London', 60_000);

    // Key does not exist in central store
    const read1 = await lhrPoP.get('missing:token');
    assert.equal(read1.value, null);
    assert.equal(read1.hit, 'negative-cache');

    // Central store creates the key shortly after
    central.put('missing:token', 'secret-val-99');

    // Read within TTL still hits negative cache!
    const read2 = await lhrPoP.get('missing:token');
    assert.equal(read2.value, null);
    assert.equal(read2.hit, 'negative-cache');

    // After eviction or TTL expiry, the new value becomes visible
    lhrPoP.evict('missing:token');
    const read3 = await lhrPoP.get('missing:token');
    assert.equal(read3.value, 'secret-val-99');
    assert.equal(read3.hit, 'central');
  });
});
