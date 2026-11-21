/**
 * Executable models for Module 23: Nearby Friends (ByteByteGo Ch. 17).
 * Covers:
 *  1. High-fanout capacity & CPU-bound vs memory-bound Pub/Sub sizing (`10M` online, `30s` refresh
 *     -> `333.3k` writes/s, `40` active friends -> `13.33M` pushes/s -> `134-140` CPU-bound nodes vs `2` RAM nodes,
 *     plus the legacy Redis Cluster `PUBLISH` O(N) cluster-bus broadcast trap vs `SPUBLISH`)
 *  2. Ephemeral TTL Location Cache (`TTL = 600 s` / 10 minutes) auto-evicting offline friends
 *  3. Stateful WebSocket + per-user Pub/Sub Router with 5-mile (`8,046.72 m`) Haversine filtering,
 *     boundary exit notifications (`LEFT_RADIUS`), dynamic friend subscribe/unsubscribe, and
 *     anti-trilateration distance bucketing (`0.5-mile` steps)
 *  4. "Nearby Random Person" Geohash Pub/Sub channel pool proving 9-cell (`center + 8 neighbors`)
 *     subscription eliminates cell-border blindness
 *  5. Consistent-Hash Pub/Sub ring resharding (`~1/(N+1)` channel relocation vs `>90%` `mod N` storm)
 */

import { haversineMeters } from './proximity-models.ts';
import { ConsistentHashRing, encodeGeohash, geohashNeighbors } from './system-design-models.ts';

export const FIVE_MILES_METERS = 8_046.72; // 5 * 1,609.344 meters
const METERS_PER_MILE = 1_609.344;

interface NearbyFanoutEstimate {
  readonly activeConcurrentUsers: number;
  readonly locationUpdateQps: number;
  readonly onlineFriendsPerUser: number;
  readonly fanoutPushesPerSec: number;
  readonly ramBoundNodeCount: number;
  readonly cpuBoundNodeCount: number;
  readonly legacyClusterBusBroadcastMsgsPerSec: number;
  readonly shardedPubSubCrossSlotMsgsPerSec: number;
}

/**
 * Computes Nearby Friends write throughput, Pub/Sub fan-out push rate, memory-bound vs
 * CPU-bound Redis/Valkey node counts, and legacy Redis Cluster `PUBLISH` cluster-bus
 * amplification vs Redis 7.0+ / Valkey Sharded Pub/Sub (`SPUBLISH`).
 */
export function estimateNearbyFriendsFanout(options: {
  totalUsers: number;
  featureDauRatio: number;
  concurrentOnlineRatio: number;
  updateIntervalSec: number;
  avgFriendsCount: number;
  onlineFriendRatio: number;
  totalChannelRamGb?: number;
  ramPerNodeGb?: number;
  maxPushesPerSecPerNode?: number;
}): NearbyFanoutEstimate {
  const channelRamGb = options.totalChannelRamGb ?? 200;
  const nodeRamGb = options.ramPerNodeGb ?? 100;
  const maxPushesPerNode = options.maxPushesPerSecPerNode ?? 100_000;

  const featureDau = options.totalUsers * options.featureDauRatio;
  const activeConcurrentUsers = featureDau * options.concurrentOnlineRatio;
  const locationUpdateQps = activeConcurrentUsers / options.updateIntervalSec;
  const onlineFriendsPerUser = options.avgFriendsCount * options.onlineFriendRatio;
  const fanoutPushesPerSec = locationUpdateQps * onlineFriendsPerUser;

  const ramBoundNodeCount = Math.ceil(channelRamGb / nodeRamGb);
  const cpuBoundNodeCount = Math.ceil(fanoutPushesPerSec / maxPushesPerNode);

  // Legacy Redis Cluster `PUBLISH` broadcasts every publish to all N nodes over the cluster bus!
  const legacyClusterBusBroadcastMsgsPerSec = locationUpdateQps * cpuBoundNodeCount;
  // Sharded Pub/Sub (`SPUBLISH` / `SSUBSCRIBE`) routes directly to the owning shard (0 broadcast)
  const shardedPubSubCrossSlotMsgsPerSec = 0;

  return {
    activeConcurrentUsers,
    locationUpdateQps,
    onlineFriendsPerUser,
    fanoutPushesPerSec,
    ramBoundNodeCount,
    cpuBoundNodeCount,
    legacyClusterBusBroadcastMsgsPerSec,
    shardedPubSubCrossSlotMsgsPerSec,
  };
}

interface CachedLocation {
  readonly userId: string;
  readonly lat: number;
  readonly lon: number;
  readonly updatedAtMs: number;
  readonly expiresAtMs: number;
}

/**
 * Ephemeral Valkey/Redis Location Cache (`user_id -> {lat, lon, timestamp}`) with strict
 * `ttlMs` (default 600,000 ms = 10 minutes). Inactive users expire automatically.
 */
export class LocationCacheWithTtl {
  readonly ttlMs: number;
  private readonly store = new Map<string, CachedLocation>();

  constructor(ttlMs = 600_000) {
    if (ttlMs <= 0) throw new RangeError('ttlMs must be > 0');
    this.ttlMs = ttlMs;
  }

  setLocation(userId: string, lat: number, lon: number, nowMs: number): void {
    this.store.set(userId, {
      userId,
      lat,
      lon,
      updatedAtMs: nowMs,
      expiresAtMs: nowMs + this.ttlMs,
    });
  }

  getLocation(userId: string, nowMs: number): CachedLocation | null {
    const entry = this.store.get(userId);
    if (!entry) return null;
    if (nowMs >= entry.expiresAtMs) {
      this.store.delete(userId);
      return null;
    }
    return entry;
  }

  mgetActiveLocations(userIds: readonly string[], nowMs: number): CachedLocation[] {
    const active: CachedLocation[] = [];
    for (const id of userIds) {
      const loc = this.getLocation(id, nowMs);
      if (loc) active.push(loc);
    }
    return active;
  }
}

/**
 * Quantizes exact meters into 0.5-mile privacy buckets (with a 0.5-mile minimum floor)
 * so a malicious friend cannot intersect 3 exact distance circles (trilateration) to
 * pinpoint a user's exact home coordinates.
 */
export function quantizeDistanceMiles(
  distanceMeters: number,
  bucketStepMiles = 0.5,
  minFloorMiles = 0.5,
): number {
  const miles = distanceMeters / METERS_PER_MILE;
  const rounded = Math.ceil(miles / bucketStepMiles) * bucketStepMiles;
  return Math.max(minFloorMiles, Number(rounded.toFixed(2)));
}

interface WsClientNotification {
  readonly recipientUserId: string;
  readonly friendId: string;
  readonly type: 'NEARBY_UPDATE' | 'LEFT_RADIUS';
  readonly distanceMeters: number;
  readonly quantizedDistanceMiles: number;
  readonly timestampMs: number;
}

/**
 * Models the Stateful WebSocket Gateway + Per-User Pub/Sub Channel Router:
 *  - On connect: stores user location in `LocationCacheWithTtl`, caches coordinates in
 *    local WS memory, subscribes to all friends' Pub/Sub channels, and seeds initial
 *    nearby friends (`distance <= radiusMeters`) via `MGET` on the Location Cache.
 *  - On periodic update: updates `LocationCacheWithTtl` + local WS memory + appends to
 *    history log, then publishes to `user_ch:{userId}`. Subscribed friend WS gateways
 *    compute exact Haversine distance against their local connected user's coordinates
 *    and push `NEARBY_UPDATE` (if `<= radiusMeters`) or `LEFT_RADIUS` (if a previously
 *    visible friend just moved outside `radiusMeters`).
 */
export class NearbyFriendsPubSubRouter {
  readonly radiusMeters: number;
  readonly exitRadiusMeters: number;
  readonly locationCache: LocationCacheWithTtl;
  private readonly wsLocalCoords = new Map<string, { lat: number; lon: number }>();
  private readonly channelSubscribers = new Map<string, Set<string>>(); // publisherId -> Set<subscriberUserId>
  private readonly currentlyVisibleFriends = new Map<string, Set<string>>(); // userId -> Set<visibleFriendId>
  readonly clientInbox = new Map<string, WsClientNotification[]>();
  readonly historyLog: Array<{ userId: string; lat: number; lon: number; timestampMs: number }> =
    [];

  constructor(options: { radiusMeters?: number; exitRadiusMeters?: number; ttlMs?: number } = {}) {
    this.radiusMeters = options.radiusMeters ?? FIVE_MILES_METERS;
    this.exitRadiusMeters = options.exitRadiusMeters ?? this.radiusMeters;
    this.locationCache = new LocationCacheWithTtl(options.ttlMs ?? 600_000);
  }

  connectClient(options: {
    userId: string;
    lat: number;
    lon: number;
    friendIds: readonly string[];
    nowMs: number;
  }): WsClientNotification[] {
    this.locationCache.setLocation(options.userId, options.lat, options.lon, options.nowMs);
    this.wsLocalCoords.set(options.userId, { lat: options.lat, lon: options.lon });
    this.historyLog.push({
      userId: options.userId,
      lat: options.lat,
      lon: options.lon,
      timestampMs: options.nowMs,
    });
    this.currentlyVisibleFriends.set(options.userId, new Set());
    this.clientInbox.set(options.userId, []);

    for (const friendId of options.friendIds) {
      this.subscribeChannel(options.userId, friendId);
    }

    // Initialization seed: pipelined MGET from TTL Location Cache for all friends
    const activeFriends = this.locationCache.mgetActiveLocations(options.friendIds, options.nowMs);
    const initialNearby: WsClientNotification[] = [];

    for (const fLoc of activeFriends) {
      const dist = haversineMeters(options.lat, options.lon, fLoc.lat, fLoc.lon);
      if (dist <= this.radiusMeters) {
        this.currentlyVisibleFriends.get(options.userId)!.add(fLoc.userId);
        const msg: WsClientNotification = {
          recipientUserId: options.userId,
          friendId: fLoc.userId,
          type: 'NEARBY_UPDATE',
          distanceMeters: dist,
          quantizedDistanceMiles: quantizeDistanceMiles(dist),
          timestampMs: fLoc.updatedAtMs,
        };
        initialNearby.push(msg);
        this.clientInbox.get(options.userId)!.push(msg);
      }
    }

    return initialNearby;
  }

  addFriend(userId: string, newFriendId: string): void {
    this.subscribeChannel(userId, newFriendId);
  }

  removeFriend(userId: string, exFriendId: string): void {
    this.channelSubscribers.get(exFriendId)?.delete(userId);
    this.currentlyVisibleFriends.get(userId)?.delete(exFriendId);
  }

  private subscribeChannel(subscriberUserId: string, publisherFriendId: string): void {
    let subs = this.channelSubscribers.get(publisherFriendId);
    if (!subs) {
      subs = new Set<string>();
      this.channelSubscribers.set(publisherFriendId, subs);
    }
    subs.add(subscriberUserId);
  }

  publishLocationUpdate(
    userId: string,
    lat: number,
    lon: number,
    nowMs: number,
  ): WsClientNotification[] {
    // 1. Persist to Location History DB, refresh TTL Location Cache, and update local WS memory
    this.historyLog.push({ userId, lat, lon, timestampMs: nowMs });
    this.locationCache.setLocation(userId, lat, lon, nowMs);
    this.wsLocalCoords.set(userId, { lat, lon });

    // 2. SPUBLISH to `user_ch:{userId}` -> fan out to all subscribed online friend WS gateways
    const subscribers = this.channelSubscribers.get(userId);
    if (!subscribers) return [];

    const delivered: WsClientNotification[] = [];
    for (const friendUserId of subscribers) {
      const friendCoords = this.wsLocalCoords.get(friendUserId);
      const friendActive = this.locationCache.getLocation(friendUserId, nowMs);
      if (!friendCoords || !friendActive) continue;

      const dist = haversineMeters(friendCoords.lat, friendCoords.lon, lat, lon);
      const visibleSet = this.currentlyVisibleFriends.get(friendUserId)!;

      if (dist <= this.radiusMeters || (visibleSet.has(userId) && dist <= this.exitRadiusMeters)) {
        visibleSet.add(userId);
        const msg: WsClientNotification = {
          recipientUserId: friendUserId,
          friendId: userId,
          type: 'NEARBY_UPDATE',
          distanceMeters: dist,
          quantizedDistanceMiles: quantizeDistanceMiles(dist),
          timestampMs: nowMs,
        };
        this.clientInbox.get(friendUserId)!.push(msg);
        delivered.push(msg);
      } else if (visibleSet.has(userId)) {
        // Friend just walked/drove outside the exitRadiusMeters deadband -> notify client to remove pin!
        visibleSet.delete(userId);
        const exitMsg: WsClientNotification = {
          recipientUserId: friendUserId,
          friendId: userId,
          type: 'LEFT_RADIUS',
          distanceMeters: dist,
          quantizedDistanceMiles: quantizeDistanceMiles(dist),
          timestampMs: nowMs,
        };
        this.clientInbox.get(friendUserId)!.push(exitMsg);
        delivered.push(exitMsg);
      }
    }

    return delivered;
  }
}

/**
 * Models the "Nearby Random Person" extension using a pool of Geohash Pub/Sub channels
 * (`geohash_ch:{hash}`). Proves why each opt-in client must subscribe to its center cell
 * PLUS all 8 neighboring Geohash channels (9 channels total) to avoid missing a random
 * person standing 20 meters away across a Geohash cell border.
 */
export class GeohashRandomDiscoveryRouter {
  readonly precision: number;
  readonly radiusMeters: number;
  private readonly geohashChannels = new Map<string, Set<string>>(); // geohash -> Set<subscriberUserId>
  private readonly userLocations = new Map<string, { lat: number; lon: number }>();

  constructor(options: { precision?: number; radiusMeters?: number } = {}) {
    this.precision = options.precision ?? 5;
    this.radiusMeters = options.radiusMeters ?? FIVE_MILES_METERS;
  }

  registerOptInUser(
    userId: string,
    lat: number,
    lon: number,
    options: { subscribeNineCellNeighbors: boolean },
  ): string[] {
    this.userLocations.set(userId, { lat, lon });
    const center = encodeGeohash(lat, lon, this.precision);
    const channels = options.subscribeNineCellNeighbors
      ? [center, ...geohashNeighbors(center)]
      : [center];

    for (const ch of channels) {
      let subs = this.geohashChannels.get(ch);
      if (!subs) {
        subs = new Set<string>();
        this.geohashChannels.set(ch, subs);
      }
      subs.add(userId);
    }
    return channels;
  }

  broadcastRandomLocation(
    senderId: string,
    lat: number,
    lon: number,
  ): Array<{ recipientId: string; distanceMeters: number }> {
    this.userLocations.set(senderId, { lat, lon });
    const senderCell = encodeGeohash(lat, lon, this.precision);
    const subscribers = this.geohashChannels.get(senderCell);
    if (!subscribers) return [];

    const matches: Array<{ recipientId: string; distanceMeters: number }> = [];
    for (const recipientId of subscribers) {
      if (recipientId === senderId) continue;
      const recLoc = this.userLocations.get(recipientId);
      if (!recLoc) continue;
      const dist = haversineMeters(recLoc.lat, recLoc.lon, lat, lon);
      if (dist <= this.radiusMeters) {
        matches.push({ recipientId, distanceMeters: dist });
      }
    }
    return matches;
  }
}

function fnv1a32(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Evaluates the fraction of active Pub/Sub channels that must be unsubscribed and
 * resubscribed when scaling a Pub/Sub cluster from `initialNodes` to `initialNodes + 1`
 * under Consistent Hashing (`ConsistentHashRing`) vs naive `hash(channel) % N`.
 */
export function evaluatePubSubRingReshard(options: {
  initialNodeCount: number;
  channelCount: number;
  vnodesPerServer?: number;
}): {
  consistentHashMovedFraction: number;
  naiveModuloMovedFraction: number;
} {
  const vnodes = options.vnodesPerServer ?? 150;
  const ringBefore = new ConsistentHashRing(vnodes);
  const ringAfter = new ConsistentHashRing(vnodes);

  for (let i = 0; i < options.initialNodeCount; i++) {
    const node = `pubsub-node-${i}`;
    ringBefore.addNode(node);
    ringAfter.addNode(node);
  }
  ringAfter.addNode(`pubsub-node-${options.initialNodeCount}`);

  let consistentMoved = 0;
  let moduloMoved = 0;
  const nextCount = options.initialNodeCount + 1;

  for (let c = 0; c < options.channelCount; c++) {
    const ch = `user_ch:${c}`;
    if (ringBefore.getNode(ch) !== ringAfter.getNode(ch)) {
      consistentMoved += 1;
    }
    const h = fnv1a32(ch);
    if (h % options.initialNodeCount !== h % nextCount) {
      moduloMoved += 1;
    }
  }

  return {
    consistentHashMovedFraction: consistentMoved / options.channelCount,
    naiveModuloMovedFraction: moduloMoved / options.channelCount,
  };
}
