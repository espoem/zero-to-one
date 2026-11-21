/**
 * Executable models for Module 22: Proximity Service (ByteByteGo Ch. 16).
 * Covers:
 *  1. Haversine spherical distance & latitude/longitude degree bounding-box math
 *     (exposing the naive constant-degree longitude bug at high latitudes: cos(60°) = 0.5)
 *  2. Geohash 9-cell (center + 8 neighbors) proximity index with sparse-area precision
 *     step-down fallback and mandatory Haversine corner post-filtering
 *  3. Adaptive in-memory Point Quadtree with urban-vs-rural leaf subdivision and
 *     branch-and-bound k-Nearest-Neighbor (kNN) spatial search
 *  4. Two-tier geospatial cache (`geohash -> business_id[]` + `business:{id} -> details`)
 *     vs naive raw `(lat, lon)` coordinate cache under ±10 m mobile GPS jitter
 *  5. Proximity capacity & memory estimator (100M DAU, 200M businesses, 5,787 avg / 28.9k peak QPS)
 */

import { encodeGeohash, geohashNeighbors } from './system-design-models.ts';

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_LAT_DEGREE = 111_319.49; // 2 * pi * 6,371,000 / 360

export interface PoiBusiness {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly category: string;
}

interface RankedBusiness {
  readonly business: PoiBusiness;
  readonly distanceMeters: number;
}

/**
 * Computes exact great-circle distance in meters between two WGS84 coordinates using Haversine.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);
  const a = sinHalfLat * sinHalfLat + Math.cos(rLat1) * Math.cos(rLat2) * sinHalfLon * sinHalfLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes the latitude and longitude degree deltas required to enclose a circle of `radiusMeters`
 * at `latDeg`, contrasting spherical `1 / cos(lat)` scaling against the naive textbook bug that
 * applies the equatorial latitude degree constant equally to longitude.
 */
export function boundingBoxDegreeDelta(
  latDeg: number,
  radiusMeters: number,
): {
  latDeltaDeg: number;
  lonDeltaDegSpherical: number;
  lonDeltaDegNaive: number;
  naiveEastWestCoverageRatio: number;
} {
  const latDeltaDeg = radiusMeters / METERS_PER_LAT_DEGREE;
  const cosLat = Math.max(1e-6, Math.cos((latDeg * Math.PI) / 180));
  const lonDeltaDegSpherical = radiusMeters / (METERS_PER_LAT_DEGREE * cosLat);
  const lonDeltaDegNaive = latDeltaDeg;
  return {
    latDeltaDeg,
    lonDeltaDegSpherical,
    lonDeltaDegNaive,
    naiveEastWestCoverageRatio: lonDeltaDegNaive / lonDeltaDegSpherical,
  };
}

/**
 * Maps a search radius in meters to the canonical Geohash character precision (levels 4..6).
 *  - <= 600 m   -> precision 6 (~1.22 km x 0.61 km at equator)
 *  - <= 2,500 m -> precision 5 (~4.89 km x 4.89 km)
 *  - >  2,500 m -> precision 4 (~39.1 km x 19.5 km)
 */
export function geohashPrecisionForRadius(radiusMeters: number): 4 | 5 | 6 {
  if (radiusMeters <= 600) return 6;
  if (radiusMeters <= 2_500) return 5;
  return 4;
}

/**
 * Geohash-backed proximity index indexing POIs across precisions 4, 5, and 6.
 *  - Queries center cell + 8 adjacent neighbors (9 cells total).
 *  - Supports sparse-area precision step-down (`p -> p - 1`) when `< minCandidatesBeforeFallback`
 *    raw candidates exist in the 9 cells.
 *  - Performs exact Haversine post-filtering to prune diagonal corner false positives.
 */
export class GeohashProximityIndex {
  private readonly businesses = new Map<string, PoiBusiness>();
  private readonly bucketsByPrecision = new Map<number, Map<string, Set<string>>>([
    [4, new Map()],
    [5, new Map()],
    [6, new Map()],
  ]);

  upsertBusiness(poi: PoiBusiness): void {
    const existing = this.businesses.get(poi.id);
    if (existing) {
      for (const p of [4, 5, 6] as const) {
        const oldHash = encodeGeohash(existing.lat, existing.lon, p);
        this.bucketsByPrecision.get(p)?.get(oldHash)?.delete(poi.id);
      }
    }

    this.businesses.set(poi.id, poi);
    for (const p of [4, 5, 6] as const) {
      const hash = encodeGeohash(poi.lat, poi.lon, p);
      const table = this.bucketsByPrecision.get(p)!;
      let bucket = table.get(hash);
      if (!bucket) {
        bucket = new Set<string>();
        table.set(hash, bucket);
      }
      bucket.add(poi.id);
    }
  }

  searchNearby(options: {
    lat: number;
    lon: number;
    radiusMeters: number;
    minCandidatesBeforeFallback?: number;
    skipHaversinePostFilterBug?: boolean;
  }): {
    results: RankedBusiness[];
    precisionUsed: number;
    cellsQueried: string[];
    rawCandidateCount: number;
  } {
    let precision: number = geohashPrecisionForRadius(options.radiusMeters);
    const minCandidates = options.minCandidatesBeforeFallback ?? 1;

    let cellsQueried: string[] = [];
    const candidateIds = new Set<string>();

    while (precision >= 4) {
      const center = encodeGeohash(options.lat, options.lon, precision);
      cellsQueried = [center, ...geohashNeighbors(center)];
      candidateIds.clear();

      const table = this.bucketsByPrecision.get(precision)!;
      for (const cell of cellsQueried) {
        const ids = table.get(cell);
        if (ids) {
          for (const id of ids) candidateIds.add(id);
        }
      }

      if (candidateIds.size >= minCandidates || precision === 4) {
        break;
      }
      precision -= 1;
    }

    const results: RankedBusiness[] = [];
    for (const id of candidateIds) {
      const biz = this.businesses.get(id)!;
      const distanceMeters = haversineMeters(options.lat, options.lon, biz.lat, biz.lon);
      if (options.skipHaversinePostFilterBug || distanceMeters <= options.radiusMeters) {
        results.push({ business: biz, distanceMeters });
      }
    }

    results.sort(
      (a, b) => a.distanceMeters - b.distanceMeters || a.business.id.localeCompare(b.business.id),
    );

    return {
      results,
      precisionUsed: precision,
      cellsQueried,
      rawCandidateCount: candidateIds.size,
    };
  }
}

interface QuadBounds {
  readonly latMin: number;
  readonly latMax: number;
  readonly lonMin: number;
  readonly lonMax: number;
}

class QuadNode {
  readonly bounds: QuadBounds;
  readonly depth: number;
  points: PoiBusiness[] = [];
  children: [QuadNode, QuadNode, QuadNode, QuadNode] | null = null;

  constructor(bounds: QuadBounds, depth: number) {
    this.bounds = bounds;
    this.depth = depth;
  }
}

/**
 * Minimum great-circle distance in meters from `(lat, lon)` to any point inside `bounds`.
 */
function minDistanceToQuadBoundsMeters(lat: number, lon: number, bounds: QuadBounds): number {
  const clampedLat = Math.max(bounds.latMin, Math.min(bounds.latMax, lat));
  const clampedLon = Math.max(bounds.lonMin, Math.min(bounds.lonMax, lon));
  return haversineMeters(lat, lon, clampedLat, clampedLon);
}

/**
 * In-memory adaptive Point Quadtree for static/slow-changing POI discovery.
 *  - Recursively subdivides a leaf into 4 quadrants (NW, NE, SW, SE) when its point count
 *    exceeds `maxLeafCapacity` (default 100 in production).
 *  - Supports exact `kNearest` neighbor search via branch-and-bound bounding-box pruning.
 */
export class PointQuadtree {
  private readonly root: QuadNode;
  private readonly maxLeafCapacity: number;
  private readonly maxDepth: number;
  private totalInserted = 0;

  constructor(
    options: {
      maxLeafCapacity?: number;
      maxDepth?: number;
      bounds?: QuadBounds;
    } = {},
  ) {
    this.maxLeafCapacity = options.maxLeafCapacity ?? 100;
    this.maxDepth = options.maxDepth ?? 18;
    this.root = new QuadNode(
      options.bounds ?? { latMin: -90, latMax: 90, lonMin: -180, lonMax: 180 },
      0,
    );
  }

  insert(poi: PoiBusiness): void {
    this.insertIntoNode(this.root, poi);
    this.totalInserted += 1;
  }

  private insertIntoNode(node: QuadNode, poi: PoiBusiness): void {
    if (node.children !== null) {
      const child = this.pickChildQuadrant(node, poi.lat, poi.lon);
      this.insertIntoNode(child, poi);
      return;
    }

    node.points.push(poi);
    if (node.points.length > this.maxLeafCapacity && node.depth < this.maxDepth) {
      this.subdivide(node);
    }
  }

  private subdivide(node: QuadNode): void {
    const { latMin, latMax, lonMin, lonMax } = node.bounds;
    const latMid = (latMin + latMax) / 2;
    const lonMid = (lonMin + lonMax) / 2;
    const nextDepth = node.depth + 1;

    const nw = new QuadNode({ latMin: latMid, latMax, lonMin, lonMax: lonMid }, nextDepth);
    const ne = new QuadNode({ latMin: latMid, latMax, lonMin: lonMid, lonMax }, nextDepth);
    const sw = new QuadNode({ latMin, latMax: latMid, lonMin, lonMax: lonMid }, nextDepth);
    const se = new QuadNode({ latMin, latMax: latMid, lonMin: lonMid, lonMax }, nextDepth);

    node.children = [nw, ne, sw, se];
    const existing = node.points;
    node.points = [];
    for (const pt of existing) {
      const child = this.pickChildQuadrant(node, pt.lat, pt.lon);
      this.insertIntoNode(child, pt);
    }
  }

  private pickChildQuadrant(node: QuadNode, lat: number, lon: number): QuadNode {
    const [nw, ne, sw, se] = node.children!;
    const latMid = (node.bounds.latMin + node.bounds.latMax) / 2;
    const lonMid = (node.bounds.lonMin + node.bounds.lonMax) / 2;
    if (lat >= latMid) {
      return lon < lonMid ? nw : ne;
    }
    return lon < lonMid ? sw : se;
  }

  getStats(): {
    totalPoints: number;
    leafCount: number;
    maxLeafDepth: number;
    minNonEmptyLeafDepth: number;
  } {
    let leafCount = 0;
    let maxLeafDepth = 0;
    let minNonEmptyLeafDepth = Infinity;

    const walk = (node: QuadNode): void => {
      if (node.children === null) {
        leafCount += 1;
        if (node.depth > maxLeafDepth) maxLeafDepth = node.depth;
        if (node.points.length > 0 && node.depth < minNonEmptyLeafDepth) {
          minNonEmptyLeafDepth = node.depth;
        }
        return;
      }
      for (const child of node.children) walk(child);
    };

    walk(this.root);
    return {
      totalPoints: this.totalInserted,
      leafCount,
      maxLeafDepth,
      minNonEmptyLeafDepth: minNonEmptyLeafDepth === Infinity ? 0 : minNonEmptyLeafDepth,
    };
  }

  /**
   * Branch-and-bound k-Nearest-Neighbor search over the quadtree.
   */
  kNearest(lat: number, lon: number, k: number): RankedBusiness[] {
    if (k <= 0) return [];
    const best: RankedBusiness[] = [];

    const visit = (node: QuadNode): void => {
      const worstBestDist = best.length < k ? Infinity : best[best.length - 1]!.distanceMeters;
      const minPossibleDist = minDistanceToQuadBoundsMeters(lat, lon, node.bounds);
      if (minPossibleDist > worstBestDist) {
        return; // Prune entire quadrant!
      }

      if (node.children === null) {
        for (const pt of node.points) {
          const d = haversineMeters(lat, lon, pt.lat, pt.lon);
          if (best.length < k || d < best[best.length - 1]!.distanceMeters) {
            best.push({ business: pt, distanceMeters: d });
            best.sort(
              (a, b) =>
                a.distanceMeters - b.distanceMeters || a.business.id.localeCompare(b.business.id),
            );
            if (best.length > k) best.pop();
          }
        }
        return;
      }

      // Visit child quadrants in ascending order of their minimum bounding-box distance
      const orderedChildren = [...node.children]
        .map((child) => ({
          child,
          minDist: minDistanceToQuadBoundsMeters(lat, lon, child.bounds),
        }))
        .sort((a, b) => a.minDist - b.minDist);

      for (const { child } of orderedChildren) {
        visit(child);
      }
    };

    visit(this.root);
    return best;
  }
}

/**
 * Contrasts the two-tier Geohash cache (`geohash:{p}:{cell} -> id[]` + `business:{id} -> details`)
 * against a naive raw `(lat, lon)` coordinate cache key under realistic ±10 m GPS jitter.
 */
export class TwoTierProximityCache {
  private readonly index: GeohashProximityIndex;
  private readonly businesses = new Map<string, PoiBusiness>();
  private readonly geohashListCache = new Map<string, string[]>();
  private readonly businessDetailCache = new Map<string, PoiBusiness>();
  private readonly naiveRawCoordCache = new Map<string, RankedBusiness[]>();

  geohashCellHits = 0;
  geohashCellMisses = 0;
  naiveCoordHits = 0;
  naiveCoordMisses = 0;

  constructor(businesses: readonly PoiBusiness[]) {
    this.index = new GeohashProximityIndex();
    for (const b of businesses) {
      this.businesses.set(b.id, b);
      this.index.upsertBusiness(b);
    }
  }

  queryNaiveRawCoordinates(lat: number, lon: number, radiusMeters: number): RankedBusiness[] {
    // Raw 6-decimal GPS coordinates (~0.11 m resolution) drift on every micro-movement
    const rawKey = `${lat.toFixed(6)}:${lon.toFixed(6)}:${radiusMeters}`;
    const cached = this.naiveRawCoordCache.get(rawKey);
    if (cached) {
      this.naiveCoordHits += 1;
      return cached;
    }
    this.naiveCoordMisses += 1;
    const computed = this.index.searchNearby({ lat, lon, radiusMeters }).results;
    this.naiveRawCoordCache.set(rawKey, computed);
    return computed;
  }

  queryTwoTierGeohashCache(lat: number, lon: number, radiusMeters: number): RankedBusiness[] {
    const precision = geohashPrecisionForRadius(radiusMeters);
    const center = encodeGeohash(lat, lon, precision);
    const cells = [center, ...geohashNeighbors(center)];
    const candidateIds = new Set<string>();

    for (const cell of cells) {
      const cacheKey = `geohash:${precision}:${cell}`;
      let cellIds = this.geohashListCache.get(cacheKey);
      if (cellIds !== undefined) {
        this.geohashCellHits += 1;
      } else {
        this.geohashCellMisses += 1;
        // Populate cell list from backing index
        cellIds = [];
        for (const b of this.businesses.values()) {
          if (encodeGeohash(b.lat, b.lon, precision) === cell) {
            cellIds.push(b.id);
          }
        }
        this.geohashListCache.set(cacheKey, cellIds);
      }
      for (const id of cellIds) candidateIds.add(id);
    }

    const results: RankedBusiness[] = [];
    for (const id of candidateIds) {
      let biz = this.businessDetailCache.get(id);
      if (!biz) {
        biz = this.businesses.get(id)!;
        this.businessDetailCache.set(id, biz);
      }
      const distanceMeters = haversineMeters(lat, lon, biz.lat, biz.lon);
      if (distanceMeters <= radiusMeters) {
        results.push({ business: biz, distanceMeters });
      }
    }

    return results.sort(
      (a, b) => a.distanceMeters - b.distanceMeters || a.business.id.localeCompare(b.business.id),
    );
  }
}

interface ProximityCapacityEstimate {
  readonly avgSearchQps: number;
  readonly peakSearchQps: number;
  readonly businessTableGb: number;
  readonly rawGeohashIndexGb: number;
  readonly valkeyMultiPrecisionRamGb: number;
  readonly fitsSingleValkeyNodeWithoutSharding: boolean;
}

/**
 * Quantitative capacity and memory estimator for a global Proximity Service (100M DAU, 200M POIs).
 */
export function estimateProximityCapacity(options: {
  dau: number;
  searchesPerUserPerDay: number;
  peakMultiplier: number;
  totalBusinesses: number;
  bytesPerBusinessRecord?: number;
  rawIndexBytesPerRow?: number;
  valkeyBytesPerIndexEntry?: number;
  indexedPrecisionsCount?: number;
  singleNodeRamCeilingGb?: number;
}): ProximityCapacityEstimate {
  const bytesPerBiz = options.bytesPerBusinessRecord ?? 1_000;
  const rawIdxBytes = options.rawIndexBytesPerRow ?? 24;
  const valkeyEntryBytes = options.valkeyBytesPerIndexEntry ?? 32;
  const precisions = options.indexedPrecisionsCount ?? 3; // precisions 4, 5, 6
  const ramCeilingGb = options.singleNodeRamCeilingGb ?? 64;

  const avgSearchQps = (options.dau * options.searchesPerUserPerDay) / 86_400;
  const peakSearchQps = avgSearchQps * options.peakMultiplier;
  const businessTableGb = (options.totalBusinesses * bytesPerBiz) / 1e9;
  const rawGeohashIndexGb = (options.totalBusinesses * rawIdxBytes) / 1e9;
  const valkeyMultiPrecisionRamGb = (options.totalBusinesses * precisions * valkeyEntryBytes) / 1e9;

  return {
    avgSearchQps,
    peakSearchQps,
    businessTableGb,
    rawGeohashIndexGb,
    valkeyMultiPrecisionRamGb,
    fitsSingleValkeyNodeWithoutSharding: valkeyMultiPrecisionRamGb <= ramCeilingGb,
  };
}
