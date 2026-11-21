export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/**
 * Web Mercator (EPSG:3857) Slippy Map tile projection:
 * converts WGS84 latitude/longitude into integer tile (x, y) at zoom level z in [0, 21].
 */
export function latLonToTile(latDeg: number, lonDeg: number, zoom: number): TileCoord {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 21) {
    throw new RangeError('zoom must be an integer in [0, 21]');
  }
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, latDeg));
  const latRad = (clampedLat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lonDeg + 180) / 360) * n)));
  const mercY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  const y = Math.min(n - 1, Math.max(0, Math.floor(mercY * n)));
  return { z: zoom, x, y };
}

/**
 * Total tiles at zoom level z is 4^z; cumulative pyramid across 0..maxZoom is (4^(z+1) - 1) / 3.
 */
export function tilePyramidStats(
  maxZoom: number,
  avgTileBytes: number,
): {
  tilesAtMaxZoom: bigint;
  totalPyramidTiles: bigint;
  uncompressedBytesAtMaxZoom: bigint;
} {
  if (!Number.isInteger(maxZoom) || maxZoom < 0) {
    throw new RangeError('maxZoom must be a non-negative integer');
  }
  const tilesAtMaxZoom = 4n ** BigInt(maxZoom);
  const totalPyramidTiles = (4n ** BigInt(maxZoom + 1) - 1n) / 3n;
  const uncompressedBytesAtMaxZoom = tilesAtMaxZoom * BigInt(Math.round(avgTileBytes));
  return { tilesAtMaxZoom, totalPyramidTiles, uncompressedBytesAtMaxZoom };
}

export interface RoadNode {
  id: string;
  xKm: number;
  yKm: number;
}

export interface RoadEdge {
  to: string;
  distanceKm: number;
  speedKmh: number;
  /** Dynamic live congestion multiplier (1.0 = free flow, 10.0 = severe accident). */
  congestionMultiplier?: number;
}

export interface RouteResult {
  path: string[];
  travelTimeMinutes: number;
  visitedNodes: number;
}

/**
 * Deterministic A* / Dijkstra road-graph shortest path solver.
 * Set `maxSpeedKmh = Infinity` (zero heuristic) to compare raw Dijkstra node expansion vs admissible A*.
 */
export function shortestPathAStar(options: {
  nodes: ReadonlyMap<string, RoadNode>;
  adjacency: ReadonlyMap<string, readonly RoadEdge[]>;
  origin: string;
  destination: string;
  maxSpeedKmh: number;
}): RouteResult {
  const { nodes, adjacency, origin, destination, maxSpeedKmh } = options;
  const destNode = nodes.get(destination);
  if (!nodes.has(origin) || !destNode) {
    throw new RangeError('origin or destination node missing');
  }

  const heuristicMin = (nodeId: string): number => {
    if (!Number.isFinite(maxSpeedKmh) || maxSpeedKmh <= 0) return 0;
    const n = nodes.get(nodeId);
    if (!n) return 0;
    const distKm = Math.hypot(n.xKm - destNode.xKm, n.yKm - destNode.yKm);
    return (distKm / maxSpeedKmh) * 60;
  };

  const gScore = new Map<string, number>([[origin, 0]]);
  const fScore = new Map<string, number>([[origin, heuristicMin(origin)]]);
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([origin]);
  const closed = new Set<string>();
  let visitedNodes = 0;

  while (open.size > 0) {
    let current: string | undefined;
    let bestF = Number.POSITIVE_INFINITY;
    for (const candidate of open) {
      const score = fScore.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (score < bestF || (score === bestF && current !== undefined && candidate < current)) {
        bestF = score;
        current = candidate;
      }
    }
    if (current === undefined) break;
    open.delete(current);
    closed.add(current);
    visitedNodes++;

    if (current === destination) {
      const path: string[] = [current];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        path.push(cursor);
      }
      path.reverse();
      return {
        path,
        travelTimeMinutes: gScore.get(destination) ?? Number.POSITIVE_INFINITY,
        visitedNodes,
      };
    }

    const edges = adjacency.get(current) ?? [];
    for (const edge of edges) {
      if (closed.has(edge.to)) continue;
      const multiplier = edge.congestionMultiplier ?? 1.0;
      const edgeMinutes = (edge.distanceKm / edge.speedKmh) * 60 * multiplier;
      const tentativeG = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edgeMinutes;
      if (tentativeG < (gScore.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(edge.to, current);
        gScore.set(edge.to, tentativeG);
        fScore.set(edge.to, tentativeG + heuristicMin(edge.to));
        open.add(edge.to);
      }
    }
  }

  return { path: [], travelTimeMinutes: Number.POSITIVE_INFINITY, visitedNodes };
}

/**
 * Encodes a tile coordinate (z, x, y) into a parent tile at `targetZoom <= z`.
 */
export function ancestorTile(tile: TileCoord, targetZoom: number): TileCoord {
  if (targetZoom < 0 || targetZoom > tile.z) {
    throw new RangeError('targetZoom must satisfy 0 <= targetZoom <= tile.z');
  }
  const shift = tile.z - targetZoom;
  return {
    z: targetZoom,
    x: tile.x >> shift,
    y: tile.y >> shift,
  };
}

export function tileKey(tile: TileCoord): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/**
 * ByteByteGo Ch. 18 Hierarchical Super-Tile Adaptive Rerouting Index:
 * stores [r_1, super(r_1), super^2(r_1), ..., enclosingRoot] per navigating user
 * so per-user memory is O(log L) instead of O(K) flat route tiles, and an incident
 * on tile r_k checks candidate impacted navigators via the inverted super-tile map.
 */
export class SuperTileRoutingIndex {
  private readonly userChainLength = new Map<string, number>();
  private readonly userRouteEdges = new Map<string, ReadonlySet<string>>();
  private readonly invertedBySuperTile = new Map<string, Set<string>>();

  registerNavigator(
    userId: string,
    originTile: TileCoord,
    destTile: TileCoord,
    routeEdges?: readonly string[],
  ): TileCoord[] {
    if (originTile.z !== destTile.z) {
      throw new RangeError('originTile and destTile must share base zoom');
    }
    const chain: TileCoord[] = [];
    let z = originTile.z;
    while (z >= 0) {
      const oAnc = ancestorTile(originTile, z);
      const dAnc = ancestorTile(destTile, z);
      chain.push(oAnc);
      if (oAnc.x === dAnc.x && oAnc.y === dAnc.y) {
        this.userChainLength.set(userId, chain.length);
        if (routeEdges) {
          this.userRouteEdges.set(userId, new Set(routeEdges));
        }
        const key = tileKey(oAnc);
        const bucket = this.invertedBySuperTile.get(key) ?? new Set<string>();
        bucket.add(userId);
        this.invertedBySuperTile.set(key, bucket);
        return chain;
      }
      z--;
    }
    return chain;
  }

  storedTilesForUser(userId: string): number {
    return this.userChainLength.get(userId) ?? 0;
  }

  /**
   * Stage 1 coarse prefilter: walks up the ancestor pyramid of `incidentTile`
   * (at most `z_base + 1` hash lookups) to find navigators whose enclosing super-tile covers it.
   */
  findCandidateUsers(incidentTile: TileCoord): string[] {
    const impacted = new Set<string>();
    for (let z = incidentTile.z; z >= 0; z--) {
      const anc = ancestorTile(incidentTile, z);
      const users = this.invertedBySuperTile.get(tileKey(anc));
      if (users) {
        for (const u of users) impacted.add(u);
      }
    }
    return [...impacted].sort();
  }

  /**
   * Stage 2 exact route-edge verification: narrows coarse super-tile candidates to
   * navigators whose active route actually traverses `incidentEdgeId`.
   */
  findImpactedUsers(incidentTile: TileCoord, incidentEdgeId: string): string[] {
    return this.findCandidateUsers(incidentTile).filter((uid) =>
      this.userRouteEdges.get(uid)?.has(incidentEdgeId),
    );
  }
}

export function estimateLocationBatching(options: {
  dau: number;
  weeklyNavMinutesPerUser: number;
  sampleIntervalSec: number;
  batchIntervalSec: number;
  peakMultiplier: number;
}): {
  avgRawSamplesPerSec: number;
  avgBatchedQps: number;
  peakBatchedQps: number;
  qpsReductionFactor: number;
} {
  const { dau, weeklyNavMinutesPerUser, sampleIntervalSec, batchIntervalSec, peakMultiplier } =
    options;
  const dailyNavSeconds = (dau * weeklyNavMinutesPerUser * 60) / 7;
  const avgRawSamplesPerSec = dailyNavSeconds / (sampleIntervalSec * 86_400);
  const qpsReductionFactor = batchIntervalSec / sampleIntervalSec;
  const avgBatchedQps = avgRawSamplesPerSec / qpsReductionFactor;
  const peakBatchedQps = avgBatchedQps * peakMultiplier;
  return { avgRawSamplesPerSec, avgBatchedQps, peakBatchedQps, qpsReductionFactor };
}

export interface RoadCandidate {
  roadId: string;
  distanceMeters: number;
  roadHeadingDeg: number;
  sameRoadAsPrevious: boolean;
}

function angularDiffDeg(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/**
 * Single-step emission + heading/continuity proxy contrasting naive Euclidean nearest-edge
 * GPS snapping against HMM-style scoring (full multi-sample O(T * S^2) Viterbi decoding
 * extends this transition score across a sequence of T batched fixes).
 */
export function snapGpsPoint(options: {
  vehicleHeadingDeg: number;
  candidates: readonly RoadCandidate[];
  mode: 'naive-euclidean' | 'hmm-heading-continuity';
}): string {
  const { vehicleHeadingDeg, candidates, mode } = options;
  if (candidates.length === 0) {
    throw new RangeError('candidates must be non-empty');
  }

  let bestId = candidates[0]!.roadId;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const c of candidates) {
    let cost: number;
    if (mode === 'naive-euclidean') {
      cost = c.distanceMeters;
    } else {
      // Negative log-likelihood proxy: Gaussian GPS emission (sigma=10m) + heading alignment + road continuity
      const emissionCost = (c.distanceMeters / 10) ** 2;
      const headingError = angularDiffDeg(vehicleHeadingDeg, c.roadHeadingDeg);
      const headingCost = (headingError / 30) ** 2;
      const transitionPenalty = c.sameRoadAsPrevious ? 0 : 2.5;
      cost = emissionCost + headingCost + transitionPenalty;
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestId = c.roadId;
    }
  }
  return bestId;
}
