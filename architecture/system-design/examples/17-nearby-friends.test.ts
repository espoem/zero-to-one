import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  FIVE_MILES_METERS,
  GeohashRandomDiscoveryRouter,
  LocationCacheWithTtl,
  NearbyFriendsPubSubRouter,
  estimateNearbyFriendsFanout,
  evaluatePubSubRingReshard,
  quantizeDistanceMiles,
} from './lib/nearby-friends-models.ts';

describe('Module 23: Nearby Friends Executable Proofs', () => {
  it('estimateNearbyFriendsFanout proves ~333.3k write QPS, ~13.33M fan-out pushes/s, ~134 CPU-bound nodes vs 2 RAM nodes, and exposes the legacy Redis Cluster PUBLISH broadcast trap', () => {
    const est = estimateNearbyFriendsFanout({
      totalUsers: 1_000_000_000,
      featureDauRatio: 0.1, // 100M DAU
      concurrentOnlineRatio: 0.1, // 10M concurrent active users
      updateIntervalSec: 30, // 30s location refresh interval
      avgFriendsCount: 400,
      onlineFriendRatio: 0.1, // 40 active online friends per user
      totalChannelRamGb: 200,
      ramPerNodeGb: 100,
      maxPushesPerSecPerNode: 100_000,
    });

    assert.equal(est.activeConcurrentUsers, 10_000_000);
    // 10,000,000 / 30 = 333,333.33 location updates/sec (~334k rounded)
    assert.ok(est.locationUpdateQps > 333_333 && est.locationUpdateQps < 333_334);
    assert.equal(est.onlineFriendsPerUser, 40);
    // 333,333.33 * 40 = 13,333,333.33 fan-out pushes/sec (~14M rounded)
    assert.ok(est.fanoutPushesPerSec > 13_333_333 && est.fanoutPushesPerSec < 13_333_334);

    // Memory requires only 2 servers (200 GB / 100 GB), whereas CPU requires 134 servers (140 with headroom)
    assert.equal(est.ramBoundNodeCount, 2);
    assert.equal(est.cpuBoundNodeCount, 134);
    assert.ok(est.cpuBoundNodeCount > 60 * est.ramBoundNodeCount);

    // Negative test: Legacy Redis Cluster `PUBLISH` broadcasts every publish to all 134 nodes
    // (333,333.33 * 134 ≈ 44.67M cluster-bus messages/sec!), whereas Sharded Pub/Sub (`SPUBLISH`) does 0 broadcasts
    assert.ok(est.legacyClusterBusBroadcastMsgsPerSec > 44_600_000);
    assert.equal(est.shardedPubSubCrossSlotMsgsPerSec, 0);
  });

  it('LocationCacheWithTtl refreshes active 30s heartbeats and automatically evicts inactive friends after the 10-minute (600s) TTL', () => {
    const cache = new LocationCacheWithTtl(600_000); // 10 minutes = 600,000 ms
    const t0 = 1_750_000_000_000;

    cache.setLocation('alice', 37.7749, -122.4194, t0);
    cache.setLocation('bob', 37.7755, -122.418, t0);

    // At t0 + 5 minutes (300,000 ms), Alice sends a heartbeat while Bob goes offline
    cache.setLocation('alice', 37.7751, -122.4192, t0 + 300_000);

    // At t0 + 9 minutes (540,000 ms), both Alice and Bob are still within their 10-min TTL
    const activeAt9m = cache.mgetActiveLocations(['alice', 'bob'], t0 + 540_000);
    assert.deepEqual(
      activeAt9m.map((x) => x.userId),
      ['alice', 'bob'],
    );

    // At t0 + 10 minutes + 1 ms (600,001 ms), Bob's 10-min TTL expires while Alice (refreshed at +5m) stays active!
    const activeAt10m = cache.mgetActiveLocations(['alice', 'bob'], t0 + 600_001);
    assert.deepEqual(
      activeAt10m.map((x) => x.userId),
      ['alice'],
    );
    assert.equal(cache.getLocation('bob', t0 + 600_001), null);
  });

  it('NearbyFriendsPubSubRouter seeds initial nearby friends, pushes updates within 5 miles, emits LEFT_RADIUS on boundary exit, supports add/remove friend, and buckets distances against trilateration', () => {
    const router = new NearbyFriendsPubSubRouter({ radiusMeters: FIVE_MILES_METERS });
    const t0 = 1_750_000_000_000;

    // Bob is ~1.2 km (~0.75 mi) away from Alice (< 5 miles); Charlie is ~12 km (~7.45 mi) away (> 5 miles)
    router.connectClient({
      userId: 'bob',
      lat: 37.785,
      lon: -122.4194,
      friendIds: ['alice'],
      nowMs: t0,
    });
    router.connectClient({
      userId: 'charlie',
      lat: 37.885,
      lon: -122.4194,
      friendIds: ['alice'],
      nowMs: t0,
    });

    // Alice connects with friends ['bob', 'charlie'] -> initialization returns ONLY Bob (<= 5 miles)
    const initialForAlice = router.connectClient({
      userId: 'alice',
      lat: 37.7749,
      lon: -122.4194,
      friendIds: ['bob', 'charlie'],
      nowMs: t0 + 1_000,
    });
    assert.equal(initialForAlice.length, 1);
    assert.equal(initialForAlice[0]?.friendId, 'bob');
    // Anti-trilateration quantization: ~0.70 miles is quantized to the 1.0-mile bucket (never raw exact meters)
    assert.equal(initialForAlice[0]?.quantizedDistanceMiles, 1);
    assert.equal(quantizeDistanceMiles(100), 0.5); // 100m clamps to 0.5-mile minimum privacy floor

    // 1. Bob moves slightly closer (~600 m / ~0.37 mi) -> Alice receives NEARBY_UPDATE
    const bobMoveIn = router.publishLocationUpdate('bob', 37.78, -122.4194, t0 + 31_000);
    assert.equal(bobMoveIn.length, 1);
    assert.equal(bobMoveIn[0]?.recipientUserId, 'alice');
    assert.equal(bobMoveIn[0]?.type, 'NEARBY_UPDATE');
    assert.equal(bobMoveIn[0]?.quantizedDistanceMiles, 0.5);

    // 2. Bob drives 10 miles away (lat = 37.93) -> crosses outside 5-mile radius -> Alice receives LEFT_RADIUS!
    const bobMoveOut = router.publishLocationUpdate('bob', 37.93, -122.4194, t0 + 61_000);
    assert.equal(bobMoveOut.length, 1);
    assert.equal(bobMoveOut[0]?.type, 'LEFT_RADIUS');

    // 3. Subsequent update from Bob while still > 5 miles away sends 0 notifications to Alice
    const bobStillFar = router.publishLocationUpdate('bob', 37.94, -122.4194, t0 + 91_000);
    assert.equal(bobStillFar.length, 0);

    // 4. Dynamic friend mutation: Alice removes Bob and adds Dave; Bob returning nearby no longer notifies Alice
    router.removeFriend('alice', 'bob');
    const bobReturnsAfterUnfriend = router.publishLocationUpdate(
      'bob',
      37.776,
      -122.4194,
      t0 + 121_000,
    );
    assert.equal(bobReturnsAfterUnfriend.length, 0);

    router.connectClient({
      userId: 'dave',
      lat: 37.776,
      lon: -122.4194,
      friendIds: [],
      nowMs: t0 + 122_000,
    });
    router.addFriend('alice', 'dave');
    const daveUpdate = router.publishLocationUpdate('dave', 37.7765, -122.4194, t0 + 152_000);
    assert.equal(daveUpdate.length, 1);
    assert.equal(daveUpdate[0]?.recipientUserId, 'alice');
    assert.equal(router.historyLog.length, 9);
  });

  it('Negative test: GeohashRandomDiscoveryRouter single-cell subscription misses border neighbor across (0,0), while 9-cell subscription delivers it', () => {
    // Two opt-in strangers ~31 meters apart straddling the (0, 0) Equator / Prime Meridian boundary
    const userA = { id: 'stranger-a', lat: -0.0001, lon: -0.0001 };
    const userB = { id: 'stranger-b', lat: 0.0001, lon: 0.0001 };

    // 1. Broken single-cell Geohash Pub/Sub subscription (`subscribeNineCellNeighbors: false`)
    const brokenRouter = new GeohashRandomDiscoveryRouter({ precision: 5 });
    brokenRouter.registerOptInUser(userA.id, userA.lat, userA.lon, {
      subscribeNineCellNeighbors: false,
    });
    const missedMatches = brokenRouter.broadcastRandomLocation(userB.id, userB.lat, userB.lon);
    assert.equal(missedMatches.length, 0, 'Single-cell geohash pub/sub misses neighbor 31m away');

    // 2. Correct 9-cell Geohash Pub/Sub subscription (`center + 8 neighbors`)
    const fixedRouter = new GeohashRandomDiscoveryRouter({ precision: 5 });
    const subChannels = fixedRouter.registerOptInUser(userA.id, userA.lat, userA.lon, {
      subscribeNineCellNeighbors: true,
    });
    assert.equal(subChannels.length, 9);

    const foundMatches = fixedRouter.broadcastRandomLocation(userB.id, userB.lat, userB.lon);
    assert.equal(foundMatches.length, 1);
    assert.equal(foundMatches[0]?.recipientId, 'stranger-a');
    assert.ok(foundMatches[0]!.distanceMeters < 40);
  });

  it('evaluatePubSubRingReshard proves consistent hashing moves ~1/(N+1) channels on scale-out vs >90% resubscription storm under naive mod N (fast-check)', () => {
    const reshard = evaluatePubSubRingReshard({
      initialNodeCount: 16,
      channelCount: 4_000,
      vnodesPerServer: 150,
    });

    // Adding 1 node to 16 (16 -> 17): ideal move fraction is 1/17 ≈ 5.88%
    assert.ok(
      reshard.consistentHashMovedFraction > 0.03 && reshard.consistentHashMovedFraction < 0.1,
      `expected ~5.9% moved channels, got ${reshard.consistentHashMovedFraction}`,
    );
    // Naive `hash % N` moves ~16/17 ≈ 94.1% of all active Pub/Sub channels!
    assert.ok(
      reshard.naiveModuloMovedFraction > 0.9,
      `expected >90% modulo churn, got ${reshard.naiveModuloMovedFraction}`,
    );

    // Property test across arbitrary cluster sizes N in [8..32]
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 32 }), (nodeCount) => {
        const res = evaluatePubSubRingReshard({
          initialNodeCount: nodeCount,
          channelCount: 600,
          vnodesPerServer: 100,
        });
        assert.ok(res.consistentHashMovedFraction < 0.22);
        assert.ok(res.naiveModuloMovedFraction > 0.8);
      }),
      { numRuns: 20 },
    );
  });
});
