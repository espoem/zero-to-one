import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export interface WeightedBackend {
  id: string;
  weight: number;
}

/**
 * Stateless cyclic Round Robin balancer.
 */
export class RoundRobinBalancer {
  private readonly backends: readonly string[];
  private cursor = 0;

  constructor(backends: readonly string[]) {
    if (backends.length === 0) throw new Error('RoundRobinBalancer requires at least one backend');
    this.backends = [...backends];
  }

  next(): string {
    const selected = this.backends[this.cursor % this.backends.length]!;
    this.cursor = (this.cursor + 1) % this.backends.length;
    return selected;
  }
}

/**
 * Nginx Smooth Weighted Round Robin (ngx_http_upstream_module).
 * Guarantees exact w_i / sum(w) share per cycle without block bursts.
 */
export class SmoothWeightedRoundRobinBalancer {
  private readonly nodes: { id: string; weight: number; currentWeight: number }[];
  private readonly totalWeight: number;

  constructor(backends: readonly WeightedBackend[]) {
    if (backends.length === 0) {
      throw new Error('SmoothWeightedRoundRobinBalancer requires at least one backend');
    }
    let total = 0;
    this.nodes = backends.map((b) => {
      if (b.weight <= 0) throw new Error(`Invalid weight for ${b.id}: ${b.weight}`);
      total += b.weight;
      return { id: b.id, weight: b.weight, currentWeight: 0 };
    });
    this.totalWeight = total;
  }

  next(): string {
    let best = this.nodes[0]!;
    for (const node of this.nodes) {
      node.currentWeight += node.weight;
      if (node.currentWeight > best.currentWeight) {
        best = node;
      }
    }
    best.currentWeight -= this.totalWeight;
    return best.id;
  }

  snapshotCurrentWeights(): number[] {
    return this.nodes.map((n) => n.currentWeight);
  }
}

/**
 * Weighted Least Connections balancer: selects argmin(active / weight).
 */
export class LeastConnectionsBalancer {
  private readonly nodes: { id: string; weight: number; active: number }[];

  constructor(backends: readonly WeightedBackend[]) {
    if (backends.length === 0) {
      throw new Error('LeastConnectionsBalancer requires at least one backend');
    }
    this.nodes = backends.map((b) => {
      if (b.weight <= 0) throw new Error(`Invalid weight for ${b.id}: ${b.weight}`);
      return { id: b.id, weight: b.weight, active: 0 };
    });
  }

  acquire(): string {
    let best = this.nodes[0]!;
    let bestScore = best.active / best.weight;
    for (let i = 1; i < this.nodes.length; i++) {
      const candidate = this.nodes[i]!;
      const score = candidate.active / candidate.weight;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    best.active++;
    return best.id;
  }

  release(id: string): void {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Unknown backend: ${id}`);
    if (node.active > 0) node.active--;
  }
}

/**
 * Deterministic Mulberry32 PRNG for reproducible P2C simulations.
 */
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Least Response Time using EWMA latency + Power of Two Random Choices (P2C).
 * Score(i) = ewmaMs_i * (active_i + 1) / weight_i.
 */
export class LeastResponseTimeP2CBalancer {
  private readonly nodes: { id: string; weight: number; active: number; ewmaMs: number }[];
  private readonly alpha: number;
  private readonly rng: () => number;

  constructor(
    backends: readonly WeightedBackend[],
    options: { alpha?: number; initialEwmaMs?: number; seed?: number } = {},
  ) {
    if (backends.length === 0) {
      throw new Error('LeastResponseTimeP2CBalancer requires at least one backend');
    }
    const alpha = options.alpha ?? 0.25;
    if (alpha <= 0 || alpha >= 1) throw new Error(`alpha must be in (0, 1), got ${alpha}`);
    const initialEwmaMs = options.initialEwmaMs ?? 5;
    this.alpha = alpha;
    this.rng = createSeededRng(options.seed ?? 0x51a7_2026);
    this.nodes = backends.map((b) => {
      if (b.weight <= 0) throw new Error(`Invalid weight for ${b.id}: ${b.weight}`);
      return { id: b.id, weight: b.weight, active: 0, ewmaMs: initialEwmaMs };
    });
  }

  private score(node: { weight: number; active: number; ewmaMs: number }): number {
    return (node.ewmaMs * (node.active + 1)) / node.weight;
  }

  acquire(): string {
    if (this.nodes.length === 1) {
      const only = this.nodes[0]!;
      only.active++;
      return only.id;
    }
    const i = Math.floor(this.rng() * this.nodes.length);
    let j = Math.floor(this.rng() * (this.nodes.length - 1));
    if (j >= i) j++;

    const a = this.nodes[i]!;
    const b = this.nodes[j]!;
    const chosen = this.score(a) <= this.score(b) ? a : b;
    chosen.active++;
    return chosen.id;
  }

  release(id: string, observedLatencyMs: number): void {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Unknown backend: ${id}`);
    if (node.active > 0) node.active--;
    node.ewmaMs = (1 - this.alpha) * node.ewmaMs + this.alpha * observedLatencyMs;
  }

  getEwma(id: string): number {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Unknown backend: ${id}`);
    return node.ewmaMs;
  }
}

function hashUint32(input: string): number {
  return crypto.createHash('sha256').update(input).digest().readUInt32BE(0);
}

/**
 * Modulo IP Hash balancer (Nginx ip_hash style: /24 IPv4 prefix or full IP).
 */
export class IpHashBalancer {
  private readonly backends: readonly string[];
  private readonly maskIpv4Slash24: boolean;

  constructor(backends: readonly string[], maskIpv4Slash24 = true) {
    if (backends.length === 0) throw new Error('IpHashBalancer requires at least one backend');
    this.backends = [...backends];
    this.maskIpv4Slash24 = maskIpv4Slash24;
  }

  private normalizeIp(ip: string): string {
    if (!this.maskIpv4Slash24) return ip;
    const octets = ip.split('.');
    if (octets.length === 4) {
      return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
    }
    return ip;
  }

  route(clientIp: string): string {
    const key = this.normalizeIp(clientIp);
    const idx = hashUint32(key) % this.backends.length;
    return this.backends[idx]!;
  }
}

interface RingEntry {
  point: number;
  backend: string;
}

/**
 * Karger Consistent Hash Ring with virtual nodes and binary-search lookup.
 */
export class ConsistentHashRing {
  private readonly vnodes: number;
  private readonly ring: RingEntry[] = [];

  constructor(backends: readonly string[], vnodes = 150) {
    if (backends.length === 0) throw new Error('ConsistentHashRing requires at least one backend');
    if (vnodes <= 0) throw new Error('vnodes must be positive');
    this.vnodes = vnodes;
    for (const backend of backends) {
      for (let v = 0; v < this.vnodes; v++) {
        this.ring.push({
          point: hashUint32(`${backend}#vnode-${v}`),
          backend,
        });
      }
    }
    this.ring.sort((a, b) => a.point - b.point);
  }

  route(key: string): string {
    const target = hashUint32(key);
    let lo = 0;
    let hi = this.ring.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid]!.point < target) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const idx = lo < this.ring.length ? lo : 0;
    return this.ring[idx]!.backend;
  }
}

describe('Module 13: Load Balancing Distribution Algorithms (L4 & L7)', () => {
  it('RoundRobin cycles uniformly across backends', () => {
    const rr = new RoundRobinBalancer(['b0', 'b1', 'b2']);
    const seq = Array.from({ length: 6 }, () => rr.next());
    assert.deepEqual(seq, ['b0', 'b1', 'b2', 'b0', 'b1', 'b2']);
  });

  it('SmoothWeightedRoundRobin produces exact Nginx [5, 1, 1] interleaving without bursts', () => {
    const swrr = new SmoothWeightedRoundRobinBalancer([
      { id: 'a', weight: 5 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
    ]);

    const cycle = Array.from({ length: 7 }, () => swrr.next());
    assert.deepEqual(cycle, ['a', 'a', 'b', 'a', 'c', 'a', 'a']);
    assert.deepEqual(swrr.snapshotCurrentWeights(), [0, 0, 0]);

    // Verify no 5-in-a-row burst across 70 requests and exact 50:10:10 ratio
    const counts = new Map<string, number>();
    let maxRunA = 0;
    let runA = 0;
    for (let i = 0; i < 70; i++) {
      const picked = swrr.next();
      counts.set(picked, (counts.get(picked) ?? 0) + 1);
      if (picked === 'a') {
        runA++;
        if (runA > maxRunA) maxRunA = runA;
      } else {
        runA = 0;
      }
    }
    assert.equal(counts.get('a'), 50);
    assert.equal(counts.get('b'), 10);
    assert.equal(counts.get('c'), 10);
    assert.ok(maxRunA <= 4, `Expected smooth interleaving without 5-burst, got run=${maxRunA}`);
  });

  it('LeastConnections routes around stalled in-flight requests and respects weights', () => {
    const lc = new LeastConnectionsBalancer([
      { id: 'srv-0', weight: 1 },
      { id: 'srv-1', weight: 2 },
      { id: 'srv-2', weight: 1 },
    ]);

    // Simulate srv-0 holding 1 active connection while weighted srv-1 absorbs the next pick
    assert.equal(lc.acquire(), 'srv-0'); // srv-0: 1/1
    assert.equal(lc.acquire(), 'srv-1'); // srv-1: 1/2
    assert.equal(lc.acquire(), 'srv-2'); // srv-2: 1/1
    // srv-1 has score 0.5 < 1.0, so it gets the 4th connection
    assert.equal(lc.acquire(), 'srv-1'); // srv-1: 2/2 = 1.0

    // Release srv-2 so it becomes least loaded (0/1)
    lc.release('srv-2');
    assert.equal(lc.acquire(), 'srv-2');
  });

  it('LeastResponseTimeEWMA + P2C detects latency spike and drains degraded backend', () => {
    const backends: WeightedBackend[] = Array.from({ length: 6 }, (_, i) => ({
      id: `node-${i}`,
      weight: 1,
    }));
    const lrt = new LeastResponseTimeP2CBalancer(backends, {
      alpha: 0.25,
      initialEwmaMs: 5,
      seed: 42,
    });

    // Warmup: node-2 degrades to 250ms while others stay at 5ms
    for (let i = 0; i < 120; i++) {
      const picked = lrt.acquire();
      const latency = picked === 'node-2' ? 250 : 5;
      lrt.release(picked, latency);
    }

    assert.ok(
      lrt.getEwma('node-2') > 50,
      `Expected degraded EWMA > 50ms (10x healthy 5ms baseline), got ${lrt.getEwma('node-2').toFixed(1)}`,
    );

    // Measure traffic share over next 600 requests with steady-state latencies
    const postCounts = new Map<string, number>();
    for (let i = 0; i < 600; i++) {
      const picked = lrt.acquire();
      postCounts.set(picked, (postCounts.get(picked) ?? 0) + 1);
      lrt.release(picked, picked === 'node-2' ? 250 : 5);
    }

    const degradedShare = (postCounts.get('node-2') ?? 0) / 600;
    assert.ok(
      degradedShare < 0.05,
      `Expected P2C+EWMA to shed slow node-2 (<5% share), got ${(degradedShare * 100).toFixed(2)}%`,
    );
  });

  it('IpHash exhibits RFC 6598 CGNAT hotspot skew across subscribers sharing a /24 gateway', () => {
    const backends = ['edge-0', 'edge-1', 'edge-2', 'edge-3', 'edge-4'];
    const ipHash = new IpHashBalancer(backends, true);

    // 250 distinct CGNAT subscribers in 100.64.42.0/24 (RFC 6598)
    const hitCounts = new Map<string, number>();
    for (let host = 1; host <= 250; host++) {
      const target = ipHash.route(`100.64.42.${host}`);
      hitCounts.set(target, (hitCounts.get(target) ?? 0) + 1);
    }

    // All 250 subscribers collapse onto a single backend under /24 IP hash
    const entries = [...hitCounts.entries()];
    assert.equal(entries.length, 1);
    const [onlyTarget, hits] = entries[0]!;
    assert.equal(hits, 250);
    assert.ok(backends.includes(onlyTarget));
  });

  it('ConsistentHashRing remaps ~1/(N+1) keys on node removal vs ~N/(N+1) for modulo IpHash', () => {
    const initialNodes = Array.from({ length: 10 }, (_, i) => `srv-${i}`);
    const afterRemoval = initialNodes.slice(0, 9); // Remove srv-9 (N+1=10 -> N=9)

    const ringBefore = new ConsistentHashRing(initialNodes, 150);
    const ringAfter = new ConsistentHashRing(afterRemoval, 150);

    const modBefore = new IpHashBalancer(initialNodes, false);
    const modAfter = new IpHashBalancer(afterRemoval, false);

    const totalKeys = 10_000;
    let ringMoved = 0;
    let ringSurvivorMoved = 0;
    let modMoved = 0;

    for (let k = 0; k < totalKeys; k++) {
      const key = `10.20.${Math.floor(k / 250)}.${k % 250}`;
      const rb = ringBefore.route(key);
      const ra = ringAfter.route(key);
      if (rb !== ra) {
        ringMoved++;
        if (rb !== 'srv-9') ringSurvivorMoved++;
      }

      if (modBefore.route(key) !== modAfter.route(key)) {
        modMoved++;
      }
    }

    const ringChurn = ringMoved / totalKeys;
    const modChurn = modMoved / totalKeys;

    // Theoretical consistent hash churn = 1 / (N + 1) = 10%; surviving keys should not relocate
    assert.ok(
      ringChurn > 0.06 && ringChurn < 0.14,
      `Expected ~10% consistent hash churn, got ${(ringChurn * 100).toFixed(2)}%`,
    );
    assert.equal(
      ringSurvivorMoved,
      0,
      'Keys on surviving nodes must never relocate on node removal',
    );

    // Theoretical modulo hash churn = N / (N + 1) = 90%
    assert.ok(
      modChurn > 0.85,
      `Expected ~90% modulo IP hash churn, got ${(modChurn * 100).toFixed(2)}%`,
    );
  });
});
