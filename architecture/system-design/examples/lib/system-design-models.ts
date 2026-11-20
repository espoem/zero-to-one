/**
 * Shared deterministic models, simulators, and building blocks for
 * architecture/system-design executable proofs.
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG & Fake Clock
// ---------------------------------------------------------------------------

/**
 * Deterministic 32-bit Mulberry32 PRNG returning values in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface Clock {
  now(): number;
}

export class FakeClock implements Clock {
  private currentMs: number;

  constructor(initialMs = 0) {
    this.currentMs = initialMs;
  }

  now(): number {
    return this.currentMs;
  }

  advance(deltaMs: number): number {
    this.currentMs += deltaMs;
    return this.currentMs;
  }

  set(ms: number): void {
    this.currentMs = ms;
  }
}

// ---------------------------------------------------------------------------
// 01. Capacity Estimation & LLM KV-Cache Sizing
// ---------------------------------------------------------------------------

export interface CapacityInput {
  dau: number;
  readsPerUserPerDay: number;
  writesPerUserPerDay: number;
  peakMultiplier: number;
  avgWritePayloadBytes: number;
  avgReadPayloadBytes: number;
  avgLatencySeconds: number;
  perServerQps: number;
  replicationFactor?: number;
  indexOverheadFraction?: number;
  retentionYears?: number;
  cacheHotFraction?: number;
  dailyUniqueReadFraction?: number;
  azCount?: number;
  headroomNodes?: number;
}

export interface CapacityEstimate {
  avgReadQps: number;
  avgWriteQps: number;
  avgTotalQps: number;
  peakReadQps: number;
  peakWriteQps: number;
  peakTotalQps: number;
  dailyRawWriteBytes: number;
  fiveYearStorageBytes: number;
  avgEgressGbps: number;
  peakEgressGbps: number;
  cacheRamBytes: number;
  littlesLawConcurrency: number;
  baseServerCount: number;
  provisionedServerCount: number;
}

const SECONDS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365;

export function littlesLawConcurrency(arrivalRatePerSec: number, avgLatencySec: number): number {
  if (arrivalRatePerSec < 0 || avgLatencySec < 0) {
    throw new RangeError('Arrival rate and latency must be non-negative');
  }
  return arrivalRatePerSec * avgLatencySec;
}

export function estimateCapacity(input: CapacityInput): CapacityEstimate {
  const replicationFactor = input.replicationFactor ?? 3;
  const indexOverheadFraction = input.indexOverheadFraction ?? 0.2;
  const retentionYears = input.retentionYears ?? 5;
  const cacheHotFraction = input.cacheHotFraction ?? 0.2;
  const dailyUniqueReadFraction = input.dailyUniqueReadFraction ?? 1;
  const azCount = input.azCount ?? 3;
  const headroomNodes = input.headroomNodes ?? 2;

  const avgReadQps = (input.dau * input.readsPerUserPerDay) / SECONDS_PER_DAY;
  const avgWriteQps = (input.dau * input.writesPerUserPerDay) / SECONDS_PER_DAY;
  const avgTotalQps = avgReadQps + avgWriteQps;

  const peakReadQps = avgReadQps * input.peakMultiplier;
  const peakWriteQps = avgWriteQps * input.peakMultiplier;
  const peakTotalQps = avgTotalQps * input.peakMultiplier;

  const dailyRawWriteBytes = input.dau * input.writesPerUserPerDay * input.avgWritePayloadBytes;
  const fiveYearStorageBytes =
    dailyRawWriteBytes *
    DAYS_PER_YEAR *
    retentionYears *
    replicationFactor *
    (1 + indexOverheadFraction);

  const avgEgressGbps = (avgReadQps * input.avgReadPayloadBytes * 8) / 1e9;
  const peakEgressGbps = (peakReadQps * input.avgReadPayloadBytes * 8) / 1e9;

  const dailyReadWorkingSetBytes =
    input.dau * input.readsPerUserPerDay * dailyUniqueReadFraction * input.avgReadPayloadBytes;
  const cacheRamBytes = dailyReadWorkingSetBytes * cacheHotFraction;

  const concurrency = littlesLawConcurrency(peakTotalQps, input.avgLatencySeconds);

  const baseServerCount = Math.ceil(peakTotalQps / input.perServerQps);
  // N + headroomNodes with multi-AZ survivability when azCount > 1
  const multiAzBase =
    azCount > 1 ? Math.ceil(baseServerCount * (azCount / (azCount - 1))) : baseServerCount;
  const provisionedServerCount = multiAzBase + headroomNodes;

  return {
    avgReadQps,
    avgWriteQps,
    avgTotalQps,
    peakReadQps,
    peakWriteQps,
    peakTotalQps,
    dailyRawWriteBytes,
    fiveYearStorageBytes,
    avgEgressGbps,
    peakEgressGbps,
    cacheRamBytes,
    littlesLawConcurrency: concurrency,
    baseServerCount,
    provisionedServerCount,
  };
}

export interface LlmKvCacheInput {
  numLayers: number;
  numKvHeads: number;
  headDim: number;
  bytesPerElement: number;
  batchSize: number;
  contextLength: number;
}

export function estimateLlmKvCacheBytes(input: LlmKvCacheInput): number {
  // 2 tensors per layer per token: Key and Value
  const bytesPerToken =
    2 * input.numLayers * input.numKvHeads * input.headDim * input.bytesPerElement;
  return input.batchSize * input.contextLength * bytesPerToken;
}

// ---------------------------------------------------------------------------
// 02. Rate Limiters
// ---------------------------------------------------------------------------

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  allow(key: string): RateLimitDecision;
}

export class TokenBucketLimiter implements RateLimiter {
  private readonly capacity: number;
  private readonly refillRatePerMs: number;
  private readonly clock: Clock;
  private readonly buckets = new Map<string, { tokens: number; lastRefillMs: number }>();

  constructor(capacity: number, refillRatePerSec: number, clock: Clock) {
    if (capacity <= 0 || refillRatePerSec <= 0) {
      throw new RangeError('capacity and refillRatePerSec must be positive');
    }
    this.capacity = capacity;
    this.refillRatePerMs = refillRatePerSec / 1000;
    this.clock = clock;
  }

  allow(key: string): RateLimitDecision {
    const now = this.clock.now();
    const existing = this.buckets.get(key) ?? { tokens: this.capacity, lastRefillMs: now };
    const elapsed = Math.max(0, now - existing.lastRefillMs);
    const refilled = Math.min(this.capacity, existing.tokens + elapsed * this.refillRatePerMs);

    if (refilled >= 1) {
      const remaining = refilled - 1;
      this.buckets.set(key, { tokens: remaining, lastRefillMs: now });
      return { allowed: true, remaining: Math.floor(remaining), retryAfterMs: 0 };
    }

    this.buckets.set(key, { tokens: refilled, lastRefillMs: now });
    const missing = 1 - refilled;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.ceil(missing / this.refillRatePerMs),
    };
  }
}

export class FixedWindowLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly windows = new Map<string, { windowId: number; count: number }>();

  constructor(limit: number, windowMs: number, clock: Clock) {
    if (limit <= 0 || windowMs <= 0) {
      throw new RangeError('limit and windowMs must be positive');
    }
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  allow(key: string): RateLimitDecision {
    const now = this.clock.now();
    const windowId = Math.floor(now / this.windowMs);
    const existing = this.windows.get(key);
    const count = existing && existing.windowId === windowId ? existing.count : 0;

    if (count < this.limit) {
      const nextCount = count + 1;
      this.windows.set(key, { windowId, count: nextCount });
      return { allowed: true, remaining: this.limit - nextCount, retryAfterMs: 0 };
    }

    const nextWindowStart = (windowId + 1) * this.windowMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, nextWindowStart - now),
    };
  }
}

export class SlidingWindowCounterLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly state = new Map<
    string,
    { currentWindowId: number; currentCount: number; prevCount: number }
  >();

  constructor(limit: number, windowMs: number, clock: Clock) {
    if (limit <= 0 || windowMs <= 0) {
      throw new RangeError('limit and windowMs must be positive');
    }
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  allow(key: string): RateLimitDecision {
    const now = this.clock.now();
    const windowId = Math.floor(now / this.windowMs);
    const windowStart = windowId * this.windowMs;
    const elapsedInCurrent = now - windowStart;
    const prevWeight = (this.windowMs - elapsedInCurrent) / this.windowMs;

    let entry = this.state.get(key);
    if (!entry) {
      entry = { currentWindowId: windowId, currentCount: 0, prevCount: 0 };
    } else if (entry.currentWindowId !== windowId) {
      const gap = windowId - entry.currentWindowId;
      entry = {
        currentWindowId: windowId,
        currentCount: 0,
        prevCount: gap === 1 ? entry.currentCount : 0,
      };
    }

    const estimated = entry.prevCount * prevWeight + entry.currentCount;
    if (estimated + 1 <= this.limit) {
      entry.currentCount += 1;
      this.state.set(key, entry);
      return {
        allowed: true,
        remaining: Math.max(0, Math.floor(this.limit - (estimated + 1))),
        retryAfterMs: 0,
      };
    }

    this.state.set(key, entry);
    // Estimate wait until prevWeight decays enough for 1 slot
    const excess = estimated + 1 - this.limit;
    const retryAfterMs =
      entry.prevCount > 0
        ? Math.ceil((excess / entry.prevCount) * this.windowMs)
        : Math.max(1, this.windowMs - elapsedInCurrent);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
}

/**
 * Generic Cell Rate Algorithm (GCRA) using a single Theoretical Arrival Time (TAT)
 * per key. Scaled by `limit` in BigInt to avoid floating-point rounding drift.
 */
export class GcraLimiter implements RateLimiter {
  private readonly limit: bigint;
  private readonly periodMs: bigint;
  private readonly burst: bigint;
  private readonly clock: Clock;
  private readonly tatMap = new Map<string, bigint>();

  constructor(limit: number, periodMs: number, burst: number, clock: Clock) {
    if (limit <= 0 || periodMs <= 0 || burst < 1) {
      throw new RangeError('limit > 0, periodMs > 0, burst >= 1 required');
    }
    this.limit = BigInt(Math.trunc(limit));
    this.periodMs = BigInt(Math.trunc(periodMs));
    this.burst = BigInt(Math.trunc(burst));
    this.clock = clock;
  }

  allow(key: string): RateLimitDecision {
    const nowScaled = BigInt(Math.trunc(this.clock.now())) * this.limit;
    const tatScaled = this.tatMap.get(key) ?? nowScaled;
    const tauScaled = (this.burst - 1n) * this.periodMs;
    const allowAtScaled = tatScaled - tauScaled;

    if (nowScaled < allowAtScaled) {
      const waitScaled = allowAtScaled - nowScaled;
      const retryAfterMs = Number((waitScaled + this.limit - 1n) / this.limit);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    const baseTat = nowScaled > tatScaled ? nowScaled : tatScaled;
    const newTat = baseTat + this.periodMs;
    this.tatMap.set(key, newTat);

    // Number of immediate slots left: floor((nowScaled + tauScaled - newTat) / periodMs) + 1?
    // Wait: next request at same `nowScaled` succeeds iff `nowScaled >= newTat - tauScaled`.
    // Each additional request adds `periodMs`, so remaining = floor((nowScaled + tauScaled - newTat) / periodMs) + 1 if >=0, else 0.
    //Wait: if newTat == nowScaled + periodMs and burst == 1 (tau == 0):
    // remaining should be 0: (nowScaled + 0 - (nowScaled + periodMs)) < 0 -> 0.
    // If burst == 2 (tau == periodMs): after 1st req, newTat = nowScaled + periodMs.
    // At same instant, 2nd req has allowAt = newTat - tau = nowScaled -> allowed (1 remaining)!
    // Formula: diff = nowScaled + tauScaled - newTat. If diff < 0 => 0; else Number(diff / periodMs) + 1.
    const headroom = nowScaled + tauScaled - newTat;
    const remaining = headroom < 0n ? 0 : Number(headroom / this.periodMs) + 1;
    return { allowed: true, remaining, retryAfterMs: 0 };
  }
}

export class RoundRobinClusterLimiter {
  private readonly nodes: RateLimiter[];
  private nextIndex = 0;

  constructor(nodes: RateLimiter[]) {
    if (nodes.length === 0) {
      throw new RangeError('At least one node limiter is required');
    }
    this.nodes = nodes;
  }

  allow(key: string): RateLimitDecision {
    const node = this.nodes[this.nextIndex % this.nodes.length];
    this.nextIndex += 1;
    if (!node) {
      throw new Error('Unreachable missing node');
    }
    return node.allow(key);
  }
}

// ---------------------------------------------------------------------------
// 03. Caching & Hashing
// ---------------------------------------------------------------------------

/**
 * 32-bit FNV-1a followed by Murmur3 fmix32 finalizer for strong avalanche
 * even across sequential node labels ("node-0#0", "node-0#1", ...).
 */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

interface RingEntry {
  token: number;
  node: string;
}

export class ConsistentHashRing {
  private readonly vnodes: number;
  private readonly nodes = new Set<string>();
  private ring: RingEntry[] = [];

  constructor(vnodes: number, initialNodes: string[] = []) {
    if (vnodes < 1) {
      throw new RangeError('vnodes must be >= 1');
    }
    this.vnodes = vnodes;
    for (const n of initialNodes) {
      this.nodes.add(n);
    }
    this.rebuild();
  }

  addNode(node: string): void {
    if (this.nodes.has(node)) return;
    this.nodes.add(node);
    this.rebuild();
  }

  removeNode(node: string): void {
    if (!this.nodes.delete(node)) return;
    this.rebuild();
  }

  getNode(key: string): string {
    if (this.ring.length === 0) {
      throw new Error('Hash ring is empty');
    }
    const target = hash32(key);
    let lo = 0;
    let hi = this.ring.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const entry = this.ring[mid];
      if (entry && entry.token < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const chosen = this.ring[lo === this.ring.length ? 0 : lo];
    if (!chosen) {
      throw new Error('Hash ring lookup failed');
    }
    return chosen.node;
  }

  private rebuild(): void {
    const entries: RingEntry[] = [];
    for (const node of this.nodes) {
      for (let v = 0; v < this.vnodes; v += 1) {
        entries.push({ token: hash32(`${node}#v${v}`), node });
      }
    }
    entries.sort((a, b) =>
      a.token !== b.token ? a.token - b.token : a.node.localeCompare(b.node),
    );
    this.ring = entries;
  }
}

export class SingleFlightCache<V> {
  private readonly cache = new Map<string, V>();
  private readonly inFlight = new Map<string, Promise<V>>();

  async getOrLoad(key: string, loader: () => Promise<V>): Promise<V> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as V;
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }
    const promise = (async () => {
      try {
        const value = await loader();
        this.cache.set(key, value);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }
}

export class LeaseCache<V> {
  private readonly store = new Map<string, V>();
  private readonly activeLeases = new Map<string, number>();
  private nextLeaseToken = 1;

  get(key: string): { hit: true; value: V } | { hit: false; leaseToken: number } {
    if (this.store.has(key)) {
      return { hit: true, value: this.store.get(key) as V };
    }
    const leaseToken = this.nextLeaseToken;
    this.nextLeaseToken += 1;
    this.activeLeases.set(key, leaseToken);
    return { hit: false, leaseToken };
  }

  invalidate(key: string): void {
    this.store.delete(key);
    // Revoke any outstanding lease by deleting it
    this.activeLeases.delete(key);
  }

  setWithLease(key: string, value: V, leaseToken: number): boolean {
    const validLease = this.activeLeases.get(key);
    if (validLease === undefined || validLease !== leaseToken) {
      return false;
    }
    this.activeLeases.delete(key);
    this.store.set(key, value);
    return true;
  }

  peek(key: string): V | undefined {
    return this.store.get(key);
  }
}

export function xfetchShouldRecompute(
  nowMs: number,
  expiryMs: number,
  recomputeDeltaMs: number,
  beta: number,
  rand01: number,
): boolean {
  if (nowMs >= expiryMs) return true;
  const clampedRand = Math.max(1e-12, Math.min(1, rand01));
  return nowMs - recomputeDeltaMs * beta * Math.log(clampedRand) >= expiryMs;
}

export class LruCache<K, V> {
  private readonly capacity: number;
  private readonly map = new Map<K, V>();

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('capacity must be >= 1');
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
      this.map.set(key, value);
      return;
    }
    if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }
}

class CountMinSketch4Bit {
  private readonly width: number;
  private readonly depth = 4;
  private readonly table: Uint8Array;
  private sampleCount = 0;
  private readonly resetThreshold: number;

  constructor(width: number, resetThreshold: number) {
    this.width = Math.max(16, width);
    this.resetThreshold = Math.max(64, resetThreshold);
    this.table = new Uint8Array(this.depth * this.width);
  }

  increment(key: string): void {
    this.sampleCount += 1;
    const h1 = hash32(key);
    const h2 = hash32(`salt:${key}`);
    for (let row = 0; row < this.depth; row += 1) {
      const idx = row * this.width + (((h1 + row * h2) >>> 0) % this.width);
      const cur = this.table[idx] ?? 0;
      if (cur < 15) {
        this.table[idx] = cur + 1;
      }
    }
    if (this.sampleCount >= this.resetThreshold) {
      for (let i = 0; i < this.table.length; i += 1) {
        this.table[i] = (this.table[i] ?? 0) >>> 1;
      }
      this.sampleCount = this.sampleCount >>> 1;
    }
  }

  estimate(key: string): number {
    const h1 = hash32(key);
    const h2 = hash32(`salt:${key}`);
    let min = 15;
    for (let row = 0; row < this.depth; row += 1) {
      const idx = row * this.width + (((h1 + row * h2) >>> 0) % this.width);
      const val = this.table[idx] ?? 0;
      if (val < min) min = val;
    }
    return min;
  }
}

/**
 * Simplified W-TinyLFU:
 * - Window LRU (admission buffer, 1%..5% of capacity, min 1)
 * - Count-Min Sketch TinyLFU admission filter
 * - Main SLRU (20% Probation + 80% Protected)
 */
export class WTinyLfuCache<V> {
  private readonly windowCap: number;
  private readonly probationCap: number;
  private readonly protectedCap: number;
  private readonly window = new Map<string, V>();
  private readonly probation = new Map<string, V>();
  private readonly protectedMap = new Map<string, V>();
  private readonly sketch: CountMinSketch4Bit;

  constructor(capacity: number) {
    if (capacity < 4) throw new RangeError('capacity must be >= 4');
    this.windowCap = Math.max(1, Math.floor(capacity * 0.05));
    const mainCap = capacity - this.windowCap;
    this.protectedCap = Math.max(1, Math.floor(mainCap * 0.8));
    this.probationCap = Math.max(1, mainCap - this.protectedCap);
    this.sketch = new CountMinSketch4Bit(capacity * 4, capacity * 10);
  }

  get(key: string): V | undefined {
    this.sketch.increment(key);

    if (this.window.has(key)) {
      const val = this.window.get(key) as V;
      this.window.delete(key);
      this.window.set(key, val);
      return val;
    }

    if (this.protectedMap.has(key)) {
      const val = this.protectedMap.get(key) as V;
      this.protectedMap.delete(key);
      this.protectedMap.set(key, val);
      return val;
    }

    if (this.probation.has(key)) {
      const val = this.probation.get(key) as V;
      this.probation.delete(key);
      this.promoteToProtected(key, val);
      return val;
    }

    return undefined;
  }

  set(key: string, value: V): void {
    this.sketch.increment(key);

    if (this.window.has(key)) {
      this.window.delete(key);
      this.window.set(key, value);
      return;
    }
    if (this.protectedMap.has(key)) {
      this.protectedMap.delete(key);
      this.protectedMap.set(key, value);
      return;
    }
    if (this.probation.has(key)) {
      this.probation.delete(key);
      this.promoteToProtected(key, value);
      return;
    }

    this.window.set(key, value);
    if (this.window.size > this.windowCap) {
      const candidateKey = this.window.keys().next().value;
      if (candidateKey === undefined) return;
      const candidateVal = this.window.get(candidateKey) as V;
      this.window.delete(candidateKey);
      this.admitFromWindow(candidateKey, candidateVal);
    }
  }

  private promoteToProtected(key: string, value: V): void {
    this.protectedMap.set(key, value);
    if (this.protectedMap.size > this.protectedCap) {
      const demoteKey = this.protectedMap.keys().next().value;
      if (demoteKey !== undefined) {
        const demoteVal = this.protectedMap.get(demoteKey) as V;
        this.protectedMap.delete(demoteKey);
        this.probation.set(demoteKey, demoteVal);
        if (this.probation.size > this.probationCap) {
          const evictKey = this.probation.keys().next().value;
          if (evictKey !== undefined) {
            this.probation.delete(evictKey);
          }
        }
      }
    }
  }

  private admitFromWindow(candidateKey: string, candidateVal: V): void {
    if (this.probation.size + this.protectedMap.size < this.probationCap + this.protectedCap) {
      this.probation.set(candidateKey, candidateVal);
      return;
    }
    const victimKey = this.probation.keys().next().value;
    if (victimKey === undefined) {
      this.probation.set(candidateKey, candidateVal);
      return;
    }
    const candFreq = this.sketch.estimate(candidateKey);
    const victimFreq = this.sketch.estimate(victimKey);
    if (candFreq > victimFreq) {
      this.probation.delete(victimKey);
      this.probation.set(candidateKey, candidateVal);
    }
    // Otherwise candidate is rejected, keeping the hotter victim in probation!
  }
}

export interface HotKeyShardConfig {
  shards: readonly string[];
  shardOpsCeiling: number;
  backgroundOpsPerSec: number;
  backgroundKeyCount: number;
  celebrityKey: string;
  celebrityOpsPerSec: number;
  /** Number of salted replicas (`key#0` .. `key#(S-1)`). Defaults to 1 (unsalted). */
  saltCount?: number;
  /** Optional L1 in-process micro-cache TTL in ms (0 = disabled). */
  l1TtlMs?: number;
  /** Number of stateless app instances holding an L1 micro-cache (used when l1TtlMs > 0). */
  appInstanceCount?: number;
  vnodes?: number;
}

export interface HotKeyShardResult {
  opsPerShard: Record<string, number>;
  maxShardOps: number;
  minShardOps: number;
  overloadedShards: string[];
  effectiveCelebrityL2OpsPerSec: number;
}

export function simulateHotKeyShards(config: HotKeyShardConfig): HotKeyShardResult {
  if (config.shards.length === 0) {
    throw new RangeError('At least one shard is required');
  }
  const saltCount = Math.max(1, config.saltCount ?? 1);
  const vnodes = config.vnodes ?? 150;
  const ring = new ConsistentHashRing(vnodes, [...config.shards]);

  const counts = new Map<string, number>();
  for (const shard of config.shards) {
    counts.set(shard, 0);
  }

  // Spread normal background traffic across distinct keys
  const bgKeyCount = Math.max(1, config.backgroundKeyCount);
  const opsPerBgKey = config.backgroundOpsPerSec / bgKeyCount;
  for (let i = 0; i < bgKeyCount; i += 1) {
    const shard = ring.getNode(`bg-key:${i}`);
    counts.set(shard, (counts.get(shard) ?? 0) + opsPerBgKey);
  }

  // L1 micro-caching collapses L2 celebrity reads to at most 1 refresh per app instance per TTL
  const l1TtlMs = config.l1TtlMs ?? 0;
  const appInstances = Math.max(1, config.appInstanceCount ?? 1);
  const effectiveCelebrityL2OpsPerSec =
    l1TtlMs > 0
      ? Math.min(config.celebrityOpsPerSec, appInstances / (l1TtlMs / 1_000))
      : config.celebrityOpsPerSec;

  const opsPerSalt = effectiveCelebrityL2OpsPerSec / saltCount;
  for (let s = 0; s < saltCount; s += 1) {
    const routedKey = saltCount === 1 ? config.celebrityKey : `${config.celebrityKey}#${s}`;
    const shard = ring.getNode(routedKey);
    counts.set(shard, (counts.get(shard) ?? 0) + opsPerSalt);
  }

  const opsPerShard: Record<string, number> = {};
  const overloadedShards: string[] = [];
  let maxShardOps = -Infinity;
  let minShardOps = Infinity;
  for (const [shard, ops] of counts.entries()) {
    opsPerShard[shard] = ops;
    if (ops > maxShardOps) maxShardOps = ops;
    if (ops < minShardOps) minShardOps = ops;
    if (ops > config.shardOpsCeiling) {
      overloadedShards.push(shard);
    }
  }

  return {
    opsPerShard,
    maxShardOps,
    minShardOps,
    overloadedShards,
    effectiveCelebrityL2OpsPerSec,
  };
}

// ---------------------------------------------------------------------------
// 04. Distributed IDs, Pagination & Geospatial Indexing
// ---------------------------------------------------------------------------

export class ClockMovedBackwardsError extends Error {
  readonly deltaMs: number;
  constructor(deltaMs: number) {
    super(`Clock moved backwards by ${deltaMs}ms`);
    this.name = 'ClockMovedBackwardsError';
    this.deltaMs = deltaMs;
  }
}

export class SnowflakeGenerator {
  private readonly epochMs: number;
  private readonly nodeId: bigint;
  private readonly clock: Clock;
  private readonly maxBackwardToleranceMs: number;
  private readonly onSequenceExhausted?: () => void;
  private lastTimestampMs = -1;
  private sequence = 0n;

  constructor(options: {
    nodeId: number;
    clock: Clock;
    epochMs?: number;
    maxBackwardToleranceMs?: number;
    onSequenceExhausted?: () => void;
  }) {
    if (options.nodeId < 0 || options.nodeId > 1023 || !Number.isInteger(options.nodeId)) {
      throw new RangeError('nodeId must be an integer in [0, 1023]');
    }
    this.nodeId = BigInt(options.nodeId);
    this.clock = options.clock;
    this.epochMs = options.epochMs ?? 1_700_000_000_000;
    this.maxBackwardToleranceMs = options.maxBackwardToleranceMs ?? 0;
    this.onSequenceExhausted = options.onSequenceExhausted;
  }

  nextId(): bigint {
    let now = this.clock.now();
    if (now < this.lastTimestampMs) {
      const delta = this.lastTimestampMs - now;
      if (delta > this.maxBackwardToleranceMs) {
        throw new ClockMovedBackwardsError(delta);
      }
      // Within tiny tolerance: pin logical timestamp to lastTimestampMs
      now = this.lastTimestampMs;
    }

    if (now === this.lastTimestampMs) {
      this.sequence = (this.sequence + 1n) & 0xfffn;
      if (this.sequence === 0n) {
        // Rolled over 4096 IDs within the same millisecond: wait for next ms
        if (this.onSequenceExhausted) {
          this.onSequenceExhausted();
        }
        now = this.clock.now();
        while (now <= this.lastTimestampMs) {
          if (now < this.lastTimestampMs) {
            throw new ClockMovedBackwardsError(this.lastTimestampMs - now);
          }
          if (!this.onSequenceExhausted) {
            throw new Error('Snowflake sequence exhausted within frozen millisecond');
          }
          this.onSequenceExhausted();
          now = this.clock.now();
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestampMs = now;
    const elapsed = BigInt(now - this.epochMs);
    return (elapsed << 22n) | (this.nodeId << 12n) | this.sequence;
  }
}

export interface FeedRow {
  id: number;
  createdAt: number;
  payload: string;
}

export class InMemoryFeedTable {
  private readonly rows: FeedRow[] = [];

  insert(row: FeedRow): void {
    this.rows.push(row);
    // Ordered by (createdAt DESC, id DESC)
    this.rows.sort((a, b) =>
      b.createdAt !== a.createdAt ? b.createdAt - a.createdAt : b.id - a.id,
    );
  }

  queryOffset(limit: number, offset: number): FeedRow[] {
    return this.rows.slice(offset, offset + limit);
  }

  queryKeyset(
    limit: number,
    cursor?: { createdAt: number; id: number },
  ): { items: FeedRow[]; nextCursor?: { createdAt: number; id: number } } {
    const filtered = cursor
      ? this.rows.filter(
          (r) =>
            r.createdAt < cursor.createdAt ||
            (r.createdAt === cursor.createdAt && r.id < cursor.id),
        )
      : this.rows;
    const items = filtered.slice(0, limit);
    const last = items[items.length - 1];
    return last ? { items, nextCursor: { createdAt: last.createdAt, id: last.id } } : { items };
  }
}

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lon: number, precision = 6): string {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let isEven = true;
  let bit = 0;
  let ch = 0;
  let hash = '';

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch = (ch << 1) | 1;
        lonMin = mid;
      } else {
        ch = ch << 1;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    isEven = !isEven;
    bit += 1;
    if (bit === 5) {
      hash += GEOHASH_BASE32[ch] ?? '';
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function decodeGeohashBounds(hash: string): {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
} {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let isEven = true;

  for (let i = 0; i < hash.length; i += 1) {
    const c = hash[i] ?? '';
    const idx = GEOHASH_BASE32.indexOf(c);
    if (idx === -1) throw new Error(`Invalid geohash char: ${c}`);
    for (let mask = 16; mask >= 1; mask >>= 1) {
      if (isEven) {
        const mid = (lonMin + lonMax) / 2;
        if ((idx & mask) !== 0) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if ((idx & mask) !== 0) latMin = mid;
        else latMax = mid;
      }
      isEven = !isEven;
    }
  }
  return { latMin, latMax, lonMin, lonMax };
}

export function geohashNeighbors(hash: string): string[] {
  const { latMin, latMax, lonMin, lonMax } = decodeGeohashBounds(hash);
  const centerLat = (latMin + latMax) / 2;
  const centerLon = (lonMin + lonMax) / 2;
  const latStep = latMax - latMin;
  const lonStep = lonMax - lonMin;
  const precision = hash.length;

  const neighbors: string[] = [];
  for (const dLat of [-1, 0, 1]) {
    for (const dLon of [-1, 0, 1]) {
      if (dLat === 0 && dLon === 0) continue;
      const nLat = Math.max(-89.999999, Math.min(89.999999, centerLat + dLat * latStep));
      let nLon = centerLon + dLon * lonStep;
      if (nLon > 180) nLon -= 360;
      if (nLon < -180) nLon += 360;
      neighbors.push(encodeGeohash(nLat, nLon, precision));
    }
  }
  return neighbors;
}

// ---------------------------------------------------------------------------
// 05. Queueing, Tail Latency, Hedging & Retry Storms
// ---------------------------------------------------------------------------

export interface QueueSimConfig {
  servers: number;
  arrivalRatePerSec: number;
  serviceRatePerServerPerSec: number;
  numRequests: number;
  discipline?: 'FIFO' | 'LIFO';
  deadlineMs?: number;
  maxQueueDepth?: number;
  seed: number;
}

export interface QueueSimResult {
  completed: number;
  succeededWithinDeadline: number;
  droppedOrTimedOut: number;
  goodputFraction: number;
  meanSojournMs: number;
  empiricalLambdaPerSec: number;
  empiricalMeanConcurrency: number;
  p99SojournMs: number;
}

function sampleExponential(ratePerMs: number, rng: () => number): number {
  const u = Math.max(1e-12, 1 - rng());
  return -Math.log(u) / ratePerMs;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export function simulateQueueing(config: QueueSimConfig): QueueSimResult {
  const rng = mulberry32(config.seed);
  const discipline = config.discipline ?? 'FIFO';
  const arrivalRatePerMs = config.arrivalRatePerSec / 1000;
  const serviceRatePerMs = config.serviceRatePerServerPerSec / 1000;

  // Generate arrival timestamps upfront
  const arrivals: number[] = new Array(config.numRequests);
  let t = 0;
  for (let i = 0; i < config.numRequests; i += 1) {
    t += sampleExponential(arrivalRatePerMs, rng);
    arrivals[i] = t;
  }

  // Server state: Infinity means idle; finite timestamp means busy until completion
  const serverFreeAt = new Array<number>(config.servers).fill(Infinity);
  const serverJobArrival = new Array<number>(config.servers).fill(0);
  const queue: number[] = [];
  const sojournTimes: number[] = [];
  let succeededWithinDeadline = 0;
  let droppedOrTimedOut = 0;
  let nextArrivalIdx = 0;
  let totalSystemTimeMs = 0;
  let lastEventTimeMs = 0;
  let activeInSystem = 0;

  while (nextArrivalIdx < config.numRequests || queue.length > 0 || activeInSystem > 0) {
    let earliestBusyCompletion = Infinity;
    let earliestBusyServer = -1;
    for (let s = 0; s < config.servers; s += 1) {
      const freeAt = serverFreeAt[s] ?? Infinity;
      if (freeAt < earliestBusyCompletion) {
        earliestBusyCompletion = freeAt;
        earliestBusyServer = s;
      }
    }

    const nextArrivalTime =
      nextArrivalIdx < config.numRequests ? (arrivals[nextArrivalIdx] ?? Infinity) : Infinity;

    if (nextArrivalTime < earliestBusyCompletion) {
      totalSystemTimeMs += activeInSystem * (nextArrivalTime - lastEventTimeMs);
      lastEventTimeMs = nextArrivalTime;
      const arrivalTime = nextArrivalTime;
      nextArrivalIdx += 1;

      // Check for an idle server
      let idleServer = -1;
      for (let s = 0; s < config.servers; s += 1) {
        if ((serverFreeAt[s] ?? Infinity) === Infinity) {
          idleServer = s;
          break;
        }
      }

      if (idleServer !== -1) {
        activeInSystem += 1;
        const serviceTime = sampleExponential(serviceRatePerMs, rng);
        serverFreeAt[idleServer] = lastEventTimeMs + serviceTime;
        serverJobArrival[idleServer] = arrivalTime;
      } else if (config.maxQueueDepth !== undefined && queue.length >= config.maxQueueDepth) {
        droppedOrTimedOut += 1;
      } else {
        activeInSystem += 1;
        queue.push(arrivalTime);
      }
    } else if (earliestBusyServer !== -1 && earliestBusyCompletion < Infinity) {
      totalSystemTimeMs += activeInSystem * (earliestBusyCompletion - lastEventTimeMs);
      lastEventTimeMs = earliestBusyCompletion;

      const completedArrival = serverJobArrival[earliestBusyServer] ?? lastEventTimeMs;
      const sojourn = lastEventTimeMs - completedArrival;
      sojournTimes.push(sojourn);
      if (config.deadlineMs === undefined || sojourn <= config.deadlineMs) {
        succeededWithinDeadline += 1;
      } else {
        droppedOrTimedOut += 1;
      }
      activeInSystem -= 1;

      if (queue.length > 0) {
        const queuedArrival = discipline === 'LIFO' ? queue.pop() : queue.shift();
        if (queuedArrival !== undefined) {
          const serviceTime = sampleExponential(serviceRatePerMs, rng);
          serverFreeAt[earliestBusyServer] = lastEventTimeMs + serviceTime;
          serverJobArrival[earliestBusyServer] = queuedArrival;
        } else {
          serverFreeAt[earliestBusyServer] = Infinity;
        }
      } else {
        serverFreeAt[earliestBusyServer] = Infinity;
      }
    } else {
      break;
    }
  }

  const totalElapsedMs = Math.max(1e-6, lastEventTimeMs);
  const completed = sojournTimes.length;
  const sumSojourn = sojournTimes.reduce((acc, v) => acc + v, 0);
  const sorted = [...sojournTimes].sort((a, b) => a - b);
  const meanSojournMs = completed > 0 ? sumSojourn / completed : 0;
  const empiricalLambdaPerSec = (completed / totalElapsedMs) * 1000;
  const empiricalMeanConcurrency = totalSystemTimeMs / totalElapsedMs;

  return {
    completed,
    succeededWithinDeadline,
    droppedOrTimedOut,
    goodputFraction: config.numRequests > 0 ? succeededWithinDeadline / config.numRequests : 0,
    meanSojournMs,
    empiricalLambdaPerSec,
    empiricalMeanConcurrency,
    p99SojournMs: percentile(sorted, 99),
  };
}

export interface FanOutSimConfig {
  fanout: number;
  numRequests: number;
  slowProb: number;
  fastMinMs: number;
  fastMaxMs: number;
  slowLatencyMs: number;
  hedgeDelayMs?: number;
  seed: number;
}

export interface FanOutSimResult {
  fanoutP99Ms: number;
  slowHitFraction: number;
  extraRequestFraction: number;
}

export function simulateFanOut(config: FanOutSimConfig): FanOutSimResult {
  const rng = mulberry32(config.seed);

  const sampleBackend = (): number => {
    if (rng() < config.slowProb) {
      return config.slowLatencyMs;
    }
    return config.fastMinMs + rng() * (config.fastMaxMs - config.fastMinMs);
  };

  const fanoutLatencies: number[] = new Array(config.numRequests);
  let slowHits = 0;
  let totalBackendCalls = 0;

  for (let req = 0; req < config.numRequests; req += 1) {
    let reqLatency = 0;
    for (let i = 0; i < config.fanout; i += 1) {
      totalBackendCalls += 1;
      let callLatency = sampleBackend();
      if (config.hedgeDelayMs !== undefined && callLatency > config.hedgeDelayMs) {
        totalBackendCalls += 1;
        const hedgeLatency = config.hedgeDelayMs + sampleBackend();
        callLatency = Math.min(callLatency, hedgeLatency);
      }
      if (callLatency > reqLatency) {
        reqLatency = callLatency;
      }
    }
    if (reqLatency >= config.slowLatencyMs) {
      slowHits += 1;
    }
    fanoutLatencies[req] = reqLatency;
  }

  fanoutLatencies.sort((a, b) => a - b);
  const baseCalls = config.numRequests * config.fanout;

  return {
    fanoutP99Ms: percentile(fanoutLatencies, 99),
    slowHitFraction: slowHits / config.numRequests,
    extraRequestFraction: (totalBackendCalls - baseCalls) / baseCalls,
  };
}

export interface RetryStormTickResult {
  finalOfferedLoad: number;
  finalSuccessRate: number;
  recovered: boolean;
}

/**
 * Discrete-tick simulation of metastable retry amplification vs retry budget + circuit breaker.
 */
export function simulateRetryStorm(options: {
  capacityPerTick: number;
  healthyBaseLoad: number;
  spikeLoad: number;
  spikeTicks: number;
  totalTicks: number;
  mode: 'blind-3x-retry' | 'retry-budget-circuit-breaker';
}): RetryStormTickResult {
  let pendingRetries: number[] = [0, 0, 0];
  let cbOpenUntilTick = -1;
  let lastOfferedLoad = 0;
  let lastSuccessRate = 1;

  for (let tick = 0; tick < options.totalTicks; tick += 1) {
    const baseArrival = tick < options.spikeTicks ? options.spikeLoad : options.healthyBaseLoad;
    const retryArrivals = pendingRetries.shift() ?? 0;
    pendingRetries.push(0);

    let admitted = baseArrival + retryArrivals;
    if (options.mode === 'retry-budget-circuit-breaker' && tick < cbOpenUntilTick) {
      // Circuit breaker sheds excess load down to 50% of capacity to drain overload
      admitted = Math.min(baseArrival, options.capacityPerTick * 0.5);
    }

    lastOfferedLoad = admitted;

    // When offered load exceeds capacity, queueing/contention degrades effective goodput
    const overloadRatio = admitted / options.capacityPerTick;
    let succeeded: number;
    if (overloadRatio <= 1) {
      succeeded = admitted;
    } else {
      // Thrashing penalty under severe overload: effective capacity drops slightly
      const effectiveCap = options.capacityPerTick * Math.max(0.5, 1 - 0.15 * (overloadRatio - 1));
      succeeded = Math.min(admitted, effectiveCap);
    }

    const failed = Math.max(0, admitted - succeeded);
    lastSuccessRate = admitted > 0 ? succeeded / admitted : 1;

    if (options.mode === 'blind-3x-retry') {
      // Every failed request injects up to 3 retry attempts in the next tick
      const nextRetries = failed * 3;
      pendingRetries[0] = (pendingRetries[0] ?? 0) + nextRetries;
    } else {
      // 10% retry budget of base traffic + circuit breaker trips if failure rate > 20%
      const retryBudget = options.healthyBaseLoad * 0.1;
      const allowedRetries = Math.min(failed, retryBudget);
      pendingRetries[0] = (pendingRetries[0] ?? 0) + allowedRetries;
      if (failed / Math.max(1, admitted) > 0.2) {
        cbOpenUntilTick = tick + 3;
      }
    }
  }

  return {
    finalOfferedLoad: lastOfferedLoad,
    finalSuccessRate: lastSuccessRate,
    recovered: lastOfferedLoad <= options.capacityPerTick && lastSuccessRate >= 0.99,
  };
}

// ---------------------------------------------------------------------------
// 06. Contention, Fencing Tokens, Double-Entry Ledger & Payments
// ---------------------------------------------------------------------------

export class VersionConflictError extends Error {
  constructor(seatId: string, expected: number, actual: number) {
    super(`Version conflict for ${seatId}: expected ${expected}, actual ${actual}`);
    this.name = 'VersionConflictError';
  }
}

export interface SeatState {
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  version: number;
  holdOwner?: string;
  holdExpiresAt?: number;
}

export class SeatInventory {
  private readonly clock: Clock;
  private readonly seats = new Map<string, SeatState>();

  constructor(seatIds: string[], clock: Clock) {
    this.clock = clock;
    for (const id of seatIds) {
      this.seats.set(id, { status: 'AVAILABLE', version: 0 });
    }
  }

  getSeat(seatId: string): SeatState {
    const seat = this.seats.get(seatId);
    if (!seat) throw new Error(`Unknown seat: ${seatId}`);
    return { ...seat };
  }

  reserveSeat(seatId: string, userId: string, expectedVersion: number, holdTtlMs: number): number {
    const seat = this.seats.get(seatId);
    if (!seat) throw new Error(`Unknown seat: ${seatId}`);
    if (seat.version !== expectedVersion) {
      throw new VersionConflictError(seatId, expectedVersion, seat.version);
    }

    const now = this.clock.now();
    const isExpiredHold =
      seat.status === 'HELD' && seat.holdExpiresAt !== undefined && now >= seat.holdExpiresAt;

    if (seat.status !== 'AVAILABLE' && !isExpiredHold) {
      throw new Error(`Seat ${seatId} is not available (status=${seat.status})`);
    }

    seat.status = 'HELD';
    seat.holdOwner = userId;
    seat.holdExpiresAt = now + holdTtlMs;
    seat.version += 1;
    return seat.version;
  }

  confirmBooking(seatId: string, userId: string, expectedVersion: number): number {
    const seat = this.seats.get(seatId);
    if (!seat) throw new Error(`Unknown seat: ${seatId}`);
    if (seat.version !== expectedVersion) {
      throw new VersionConflictError(seatId, expectedVersion, seat.version);
    }
    const now = this.clock.now();
    if (
      seat.status !== 'HELD' ||
      seat.holdOwner !== userId ||
      seat.holdExpiresAt === undefined ||
      now >= seat.holdExpiresAt
    ) {
      throw new Error(`Hold invalid or expired for seat ${seatId}`);
    }

    seat.status = 'BOOKED';
    seat.holdExpiresAt = undefined;
    seat.version += 1;
    return seat.version;
  }
}

export class StaleFencingTokenError extends Error {
  constructor(token: number, highestSeen: number) {
    super(`Rejected stale fencing token ${token} < highest seen ${highestSeen}`);
    this.name = 'StaleFencingTokenError';
  }
}

export class DistributedLockWithFencing {
  private readonly clock: Clock;
  private holder: string | undefined;
  private expiresAt = 0;
  private nextToken = 0;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  acquire(
    clientId: string,
    ttlMs: number,
  ): { acquired: true; token: number } | { acquired: false } {
    const now = this.clock.now();
    if (this.holder !== undefined && now < this.expiresAt) {
      return { acquired: false };
    }
    this.holder = clientId;
    this.expiresAt = now + ttlMs;
    this.nextToken += 1;
    return { acquired: true, token: this.nextToken };
  }
}

export class FencedStorage<V> {
  private readonly data = new Map<string, V>();
  private readonly highestToken = new Map<string, number>();

  unfencedWrite(key: string, value: V): void {
    this.data.set(key, value);
  }

  fencedWrite(key: string, value: V, token: number): void {
    const highest = this.highestToken.get(key) ?? 0;
    if (token < highest) {
      throw new StaleFencingTokenError(token, highest);
    }
    this.highestToken.set(key, token);
    this.data.set(key, value);
  }

  read(key: string): V | undefined {
    return this.data.get(key);
  }
}

export class UnbalancedJournalError extends Error {
  constructor(debits: number, credits: number) {
    super(`Journal entry is unbalanced: debits=${debits} !== credits=${credits}`);
    this.name = 'UnbalancedJournalError';
  }
}

export class InvalidMinorUnitError extends Error {
  constructor(amount: number) {
    super(`Invalid minor unit amount: ${amount} (must be positive safe integer)`);
    this.name = 'InvalidMinorUnitError';
  }
}

export interface JournalPosting {
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  amountMinor: number;
}

export interface CommittedJournal {
  entryId: string;
  postings: JournalPosting[];
  debitSum: number;
  creditSum: number;
}

export class DoubleEntryLedger {
  private readonly journals = new Map<string, CommittedJournal>();
  private readonly balances = new Map<string, number>();

  postJournalEntry(entryId: string, postings: JournalPosting[]): CommittedJournal {
    const existing = this.journals.get(entryId);
    if (existing) {
      return existing;
    }
    if (postings.length < 2) {
      throw new Error('Journal entry requires at least two postings');
    }

    let debitSum = 0;
    let creditSum = 0;
    for (const p of postings) {
      if (!Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0) {
        throw new InvalidMinorUnitError(p.amountMinor);
      }
      if (p.side === 'DEBIT') {
        debitSum += p.amountMinor;
      } else {
        creditSum += p.amountMinor;
      }
    }

    if (debitSum !== creditSum) {
      throw new UnbalancedJournalError(debitSum, creditSum);
    }

    for (const p of postings) {
      const cur = this.balances.get(p.accountId) ?? 0;
      const delta = p.side === 'DEBIT' ? p.amountMinor : -p.amountMinor;
      this.balances.set(p.accountId, cur + delta);
    }

    const committed: CommittedJournal = {
      entryId,
      postings: postings.map((p) => ({ ...p })),
      debitSum,
      creditSum,
    };
    this.journals.set(entryId, committed);
    return committed;
  }

  totalDebits(): number {
    let sum = 0;
    for (const j of this.journals.values()) {
      sum += j.debitSum;
    }
    return sum;
  }

  totalCredits(): number {
    let sum = 0;
    for (const j of this.journals.values()) {
      sum += j.creditSum;
    }
    return sum;
  }

  netLedgerSum(): number {
    let sum = 0;
    for (const b of this.balances.values()) {
      sum += b;
    }
    return sum;
  }

  getJournals(): CommittedJournal[] {
    return [...this.journals.values()];
  }
}

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;
  constructor(key: string) {
    super(`409 Conflict: Idempotency key ${key} reused with different payload`);
    this.name = 'IdempotencyConflictError';
  }
}

export class DuplicateOrderError extends Error {
  readonly statusCode = 409;
  constructor(orderId: string, existingStatus: PaymentStatus) {
    super(
      `409 Conflict: Order ${orderId} already has an active or settled payment (${existingStatus})`,
    );
    this.name = 'DuplicateOrderError';
  }
}

export class PspTimeoutError extends Error {
  constructor() {
    super('PSP gateway request timed out — outcome unknown');
    this.name = 'PspTimeoutError';
  }
}

export type PaymentStatus = 'SUCCEEDED' | 'FAILED' | 'PENDING_RECONCILIATION';

export interface PaymentRequest {
  idempotencyKey: string;
  orderId: string;
  amountMinor: number;
  currency: string;
}

export interface PaymentRecord {
  paymentId: string;
  idempotencyKey: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  pspCalls: number;
}

export interface PspClient {
  charge(orderId: string, amountMinor: number, currency: string): 'SUCCEEDED' | 'FAILED';
}

export class PaymentService {
  private readonly psp: PspClient;
  private readonly recordsByKey = new Map<string, PaymentRecord>();
  private readonly recordsByOrder = new Map<string, PaymentRecord>();
  private nextPaymentSeq = 1;

  constructor(psp: PspClient) {
    this.psp = psp;
  }

  charge(req: PaymentRequest): PaymentRecord {
    const existing = this.recordsByKey.get(req.idempotencyKey);
    if (existing) {
      if (
        existing.orderId !== req.orderId ||
        existing.amountMinor !== req.amountMinor ||
        existing.currency !== req.currency
      ) {
        throw new IdempotencyConflictError(req.idempotencyKey);
      }
      return { ...existing };
    }

    const existingOrder = this.recordsByOrder.get(req.orderId);
    if (
      existingOrder &&
      (existingOrder.status === 'SUCCEEDED' || existingOrder.status === 'PENDING_RECONCILIATION')
    ) {
      throw new DuplicateOrderError(req.orderId, existingOrder.status);
    }

    const paymentId = `pay_${this.nextPaymentSeq}`;
    this.nextPaymentSeq += 1;

    let status: PaymentStatus;
    try {
      status = this.psp.charge(req.orderId, req.amountMinor, req.currency);
    } catch (err) {
      if (err instanceof PspTimeoutError) {
        status = 'PENDING_RECONCILIATION';
      } else {
        throw err;
      }
    }

    const record: PaymentRecord = {
      paymentId,
      idempotencyKey: req.idempotencyKey,
      orderId: req.orderId,
      amountMinor: req.amountMinor,
      currency: req.currency,
      status,
      pspCalls: 1,
    };
    this.recordsByKey.set(req.idempotencyKey, record);
    this.recordsByOrder.set(req.orderId, record);
    return { ...record };
  }

  reconcileSettlement(settlements: Map<string, 'SUCCEEDED' | 'FAILED'>): number {
    let resolved = 0;
    for (const record of this.recordsByKey.values()) {
      if (record.status === 'PENDING_RECONCILIATION') {
        const settled = settlements.get(record.orderId);
        if (settled) {
          record.status = settled;
          resolved += 1;
        }
      }
    }
    return resolved;
  }
}

// ---------------------------------------------------------------------------
// 07. SLO Burn Rates, Histogram Merging & Health Checks
// ---------------------------------------------------------------------------

export interface BurnRateWindowSpec {
  name: string;
  severity: 'PAGE' | 'TICKET';
  longWindowMinutes: number;
  shortWindowMinutes: number;
  budgetConsumedFraction: number;
  burnRateThreshold: number;
}

export const SRE_30D_BURN_RATE_RULES: readonly BurnRateWindowSpec[] = [
  {
    name: 'page-1h-5m',
    severity: 'PAGE',
    longWindowMinutes: 60,
    shortWindowMinutes: 5,
    budgetConsumedFraction: 0.02,
    burnRateThreshold: 14.4,
  },
  {
    name: 'page-6h-30m',
    severity: 'PAGE',
    longWindowMinutes: 360,
    shortWindowMinutes: 30,
    budgetConsumedFraction: 0.05,
    burnRateThreshold: 6,
  },
  {
    name: 'ticket-3d-6h',
    severity: 'TICKET',
    longWindowMinutes: 4320,
    shortWindowMinutes: 360,
    budgetConsumedFraction: 0.1,
    burnRateThreshold: 1,
  },
];

export interface MinuteSlice {
  requests: number;
  errors: number;
}

export function computeBurnRateThreshold(
  sloWindowHours: number,
  longWindowHours: number,
  budgetConsumedFraction: number,
): number {
  return (budgetConsumedFraction * sloWindowHours) / longWindowHours;
}

export function evaluateBurnRateAlerts(
  minuteHistory: readonly MinuteSlice[],
  nowMinute: number,
  sloTarget: number,
  rules: readonly BurnRateWindowSpec[] = SRE_30D_BURN_RATE_RULES,
): Array<{
  name: string;
  severity: 'PAGE' | 'TICKET';
  firing: boolean;
  longBurn: number;
  shortBurn: number;
}> {
  const errorBudget = 1 - sloTarget;

  const windowBurnRate = (windowMinutes: number): number => {
    const start = Math.max(0, nowMinute - windowMinutes);
    let reqs = 0;
    let errs = 0;
    for (let m = start; m < nowMinute; m += 1) {
      const slice = minuteHistory[m];
      if (slice) {
        reqs += slice.requests;
        errs += slice.errors;
      }
    }
    if (reqs === 0) return 0;
    return errs / reqs / errorBudget;
  };

  return rules.map((rule) => {
    const longBurn = windowBurnRate(rule.longWindowMinutes);
    const shortBurn = windowBurnRate(rule.shortWindowMinutes);
    return {
      name: rule.name,
      severity: rule.severity,
      firing: longBurn >= rule.burnRateThreshold && shortBurn >= rule.burnRateThreshold,
      longBurn,
      shortBurn,
    };
  });
}

export interface CumulativeHistogram {
  /** Upper bounds in ms, sorted ascending (not including +Inf, or +Inf as total) */
  boundsMs: number[];
  /** Cumulative counts per bound, plus totalCount */
  cumulativeCounts: number[];
  totalCount: number;
}

export function buildHistogram(
  samplesMs: readonly number[],
  boundsMs: readonly number[],
): CumulativeHistogram {
  const sortedBounds = [...boundsMs].sort((a, b) => a - b);
  const cumulativeCounts = new Array<number>(sortedBounds.length).fill(0);
  for (const s of samplesMs) {
    for (let i = 0; i < sortedBounds.length; i += 1) {
      const bound = sortedBounds[i] ?? Infinity;
      if (s <= bound) {
        cumulativeCounts[i] = (cumulativeCounts[i] ?? 0) + 1;
      }
    }
  }
  return {
    boundsMs: sortedBounds,
    cumulativeCounts,
    totalCount: samplesMs.length,
  };
}

export function mergeHistograms(histograms: readonly CumulativeHistogram[]): CumulativeHistogram {
  const first = histograms[0];
  if (!first) {
    return { boundsMs: [], cumulativeCounts: [], totalCount: 0 };
  }
  const mergedCounts = new Array<number>(first.boundsMs.length).fill(0);
  let totalCount = 0;
  for (const h of histograms) {
    totalCount += h.totalCount;
    for (let i = 0; i < first.boundsMs.length; i += 1) {
      mergedCounts[i] = (mergedCounts[i] ?? 0) + (h.cumulativeCounts[i] ?? 0);
    }
  }
  return {
    boundsMs: [...first.boundsMs],
    cumulativeCounts: mergedCounts,
    totalCount,
  };
}

export function histogramQuantile(hist: CumulativeHistogram, q: number): number {
  if (hist.totalCount === 0) return 0;
  const targetRank = q * hist.totalCount;
  for (let i = 0; i < hist.boundsMs.length; i += 1) {
    const count = hist.cumulativeCounts[i] ?? 0;
    if (count >= targetRank) {
      const prevCount = i > 0 ? (hist.cumulativeCounts[i - 1] ?? 0) : 0;
      const prevBound = i > 0 ? (hist.boundsMs[i - 1] ?? 0) : 0;
      const curBound = hist.boundsMs[i] ?? 0;
      const bucketCount = count - prevCount;
      if (bucketCount <= 0) return curBound;
      const frac = (targetRank - prevCount) / bucketCount;
      return prevBound + frac * (curBound - prevBound);
    }
  }
  return hist.boundsMs[hist.boundsMs.length - 1] ?? Infinity;
}

export interface FleetHealthOutcome {
  healthyInstances: number;
  ejectedInstances: number;
  canServeDegradedTraffic: boolean;
}

export function simulateLbHealthCheck(options: {
  instanceCount: number;
  dbReachable: boolean;
  probeMode: 'deep-db' | 'shallow-liveness-fail-open-readiness';
}): FleetHealthOutcome {
  let healthy = 0;
  for (let i = 0; i < options.instanceCount; i += 1) {
    if (options.probeMode === 'deep-db') {
      if (options.dbReachable) healthy += 1;
    } else {
      // Process is alive and serves cached/degraded responses even when DB blips
      healthy += 1;
    }
  }
  return {
    healthyInstances: healthy,
    ejectedInstances: options.instanceCount - healthy,
    canServeDegradedTraffic: healthy > 0,
  };
}

export interface TsdbCardinalityInput {
  metricNames: number;
  instanceCount: number;
  labelCardinalities: Record<string, number>;
  seriesPerMetric?: number;
  bytesPerActiveSeries?: number;
  ramBudgetBytes: number;
}

export interface TsdbCardinalityEstimate {
  labelProduct: number;
  activeSeries: number;
  estimatedHeadRamBytes: number;
  exceedsRamBudget: boolean;
  ramUtilizationRatio: number;
}

export function estimateTsdbCardinality(input: TsdbCardinalityInput): TsdbCardinalityEstimate {
  if (input.metricNames < 0 || input.instanceCount < 0 || input.ramBudgetBytes <= 0) {
    throw new RangeError('metricNames and instanceCount must be >= 0 and ramBudgetBytes > 0');
  }
  const seriesPerMetric = input.seriesPerMetric ?? 1;
  const bytesPerActiveSeries = input.bytesPerActiveSeries ?? 4_096;

  let labelProduct = 1;
  for (const cardinality of Object.values(input.labelCardinalities)) {
    if (cardinality < 0) {
      throw new RangeError('Label cardinality must be non-negative');
    }
    labelProduct *= cardinality;
  }

  const activeSeries = input.metricNames * seriesPerMetric * input.instanceCount * labelProduct;
  const estimatedHeadRamBytes = activeSeries * bytesPerActiveSeries;
  const ramUtilizationRatio = estimatedHeadRamBytes / input.ramBudgetBytes;

  return {
    labelProduct,
    activeSeries,
    estimatedHeadRamBytes,
    exceedsRamBudget: estimatedHeadRamBytes > input.ramBudgetBytes,
    ramUtilizationRatio,
  };
}
