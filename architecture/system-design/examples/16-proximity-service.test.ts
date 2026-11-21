import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  GeohashProximityIndex,
  PointQuadtree,
  TwoTierProximityCache,
  boundingBoxDegreeDelta,
  estimateProximityCapacity,
  geohashPrecisionForRadius,
  haversineMeters,
  type PoiBusiness,
} from './lib/proximity-models.ts';

describe('Module 22: Proximity Service Executable Proofs', () => {
  it('PointQuadtree subdivides dense urban clusters deeper than sparse rural regions and matches a brute-force Haversine kNN oracle', () => {
    const quadtree = new PointQuadtree({ maxLeafCapacity: 4, maxDepth: 16 });
    const allPois: PoiBusiness[] = [];

    // 40 dense urban businesses clustered tightly around downtown San Francisco (37.775, -122.419)
    for (let i = 0; i < 40; i++) {
      const poi: PoiBusiness = {
        id: `sf-urban-${i}`,
        name: `SF Cafe #${i}`,
        lat: 37.7749 + ((i % 8) - 4) * 0.0004,
        lon: -122.4194 + (Math.floor(i / 8) - 2) * 0.0004,
        category: 'cafe',
      };
      allPois.push(poi);
      quadtree.insert(poi);
    }

    // 3 sparse rural businesses scattered across Nevada desert and Australian outback
    const ruralPois: PoiBusiness[] = [
      { id: 'nv-rural-1', name: 'Desert Gas 1', lat: 39.5, lon: -117.0, category: 'gas' },
      { id: 'nv-rural-2', name: 'Desert Gas 2', lat: 40.2, lon: -115.5, category: 'gas' },
      { id: 'au-outback-1', name: 'Outback Roadhouse', lat: -23.7, lon: 133.8, category: 'gas' },
    ];
    for (const r of ruralPois) {
      allPois.push(r);
      quadtree.insert(r);
    }

    const stats = quadtree.getStats();
    assert.equal(stats.totalPoints, 43);
    // Urban quadrant subdivides deeply (depth >= 12) while rural quadrants stay shallow (depth <= 5)
    assert.ok(stats.maxLeafDepth >= 12, `expected deep urban leaf, got ${stats.maxLeafDepth}`);
    assert.ok(
      stats.minNonEmptyLeafDepth <= 2,
      `expected shallow rural leaf, got ${stats.minNonEmptyLeafDepth}`,
    );
    assert.ok(stats.maxLeafDepth > stats.minNonEmptyLeafDepth + 8);

    // Verify kNearest (k = 7) matches brute-force Haversine oracle from two distinct query points
    for (const q of [
      { lat: 37.7751, lon: -122.4191 },
      { lat: 39.6, lon: -116.8 },
    ]) {
      const knn = quadtree.kNearest(q.lat, q.lon, 7);
      const oracle = [...allPois]
        .map((business) => ({
          business,
          distanceMeters: haversineMeters(q.lat, q.lon, business.lat, business.lon),
        }))
        .sort(
          (a, b) =>
            a.distanceMeters - b.distanceMeters || a.business.id.localeCompare(b.business.id),
        )
        .slice(0, 7);

      assert.deepEqual(
        knn.map((r) => r.business.id),
        oracle.map((r) => r.business.id),
      );
    }
  });

  it('GeohashProximityIndex resolves 9 neighbor cells, steps down precision in sparse zones, and prunes cell-corner false positives via Haversine post-filtering', () => {
    assert.equal(geohashPrecisionForRadius(500), 6);
    assert.equal(geohashPrecisionForRadius(2_000), 5);
    assert.equal(geohashPrecisionForRadius(10_000), 4);

    const index = new GeohashProximityIndex();
    const userLat = 37.77672;
    const userLon = -122.41673;

    // 1. Inside 500 m radius (~120 m away)
    index.upsertBusiness({
      id: 'biz-inside-120m',
      name: 'Market St Coffee',
      lat: 37.7776,
      lon: -122.4159,
      category: 'cafe',
    });

    // 2. Corner false positive: inside one of the 8 neighbor precision-6 geohash cells,
    //    but ~780 m away (> 500 m search radius)!
    index.upsertBusiness({
      id: 'biz-corner-780m',
      name: 'Far Corner Bistro',
      lat: 37.7825,
      lon: -122.4218,
      category: 'restaurant',
    });

    // 3. Rural POI ~3.2 km away (outside precision-6 9-cell neighborhood, inside precision-5)
    index.upsertBusiness({
      id: 'biz-sparse-3200m',
      name: 'Distant Outpost',
      lat: 37.804,
      lon: -122.425,
      category: 'gas',
    });

    // Negative test: skipping Haversine post-filter erroneously returns the 780 m corner POI for a 500 m query!
    const unfiltered = index.searchNearby({
      lat: userLat,
      lon: userLon,
      radiusMeters: 500,
      skipHaversinePostFilterBug: true,
    });
    assert.equal(unfiltered.precisionUsed, 6);
    assert.equal(unfiltered.cellsQueried.length, 9);
    assert.ok(unfiltered.results.some((r) => r.business.id === 'biz-corner-780m'));

    // Positive test: exact Haversine post-filter prunes the 780 m corner false positive
    const filtered = index.searchNearby({
      lat: userLat,
      lon: userLon,
      radiusMeters: 500,
    });
    assert.deepEqual(
      filtered.results.map((r) => r.business.id),
      ['biz-inside-120m'],
    );

    // Sparse-area precision step-down: requiring >= 3 candidates steps down from precision 6 -> 5
    const fallbackSearch = index.searchNearby({
      lat: userLat,
      lon: userLon,
      radiusMeters: 500,
      minCandidatesBeforeFallback: 3,
      skipHaversinePostFilterBug: true,
    });
    assert.equal(fallbackSearch.precisionUsed, 5);
    assert.equal(fallbackSearch.rawCandidateCount, 3);
  });

  it('Negative test: naive SQL constant-degree bounding box shrinks East-West longitude coverage by 50% at 60 deg N (Oslo) vs spherical cos(lat) scaling', () => {
    // At Oslo / Helsinki (latitude = 60° N), cos(60°) = 0.5
    const osloLat = 60.0;
    const osloLon = 10.75;
    const radiusMeters = 5_000;

    const deltas = boundingBoxDegreeDelta(osloLat, radiusMeters);
    assert.ok(Math.abs(deltas.naiveEastWestCoverageRatio - 0.5) < 1e-6);

    // A restaurant 4.0 km due East of the user in Oslo:
    // Spherical delta for 4.0 km at 60°N is ~0.07186 degrees longitude, which is > naive 5 km delta (~0.04491 deg)!
    const restaurant4kmEastLon =
      osloLon + 4_000 / (111_319.49 * Math.cos((osloLat * Math.PI) / 180));
    const trueDistanceMeters = haversineMeters(osloLat, osloLon, osloLat, restaurant4kmEastLon);
    assert.ok(trueDistanceMeters > 3_990 && trueDistanceMeters < 4_010);

    // Naive bounding box (`lon BETWEEN osloLon - lonDeltaDegNaive AND osloLon + lonDeltaDegNaive`) MISSES a 4 km restaurant on a 5 km search!
    const caughtByNaiveSql = Math.abs(restaurant4kmEastLon - osloLon) <= deltas.lonDeltaDegNaive;
    const caughtBySphericalSql =
      Math.abs(restaurant4kmEastLon - osloLon) <= deltas.lonDeltaDegSpherical;

    assert.equal(caughtByNaiveSql, false);
    assert.equal(caughtBySphericalSql, true);
  });

  it('TwoTierProximityCache achieves >95% hit rate under ±10 m GPS jitter where raw (lat, lon) caching collapses to 0%, and Haversine satisfies metric axioms (fast-check)', () => {
    const businesses: PoiBusiness[] = [
      { id: 'b-1', name: 'Bistro 1', lat: 37.7768, lon: -122.4166, category: 'food' },
      { id: 'b-2', name: 'Bistro 2', lat: 37.7771, lon: -122.4162, category: 'food' },
    ];
    const cache = new TwoTierProximityCache(businesses);

    // Simulate 60 consecutive queries from pedestrians walking/drifting ±10 m around (37.7767, -122.4167)
    for (let i = 0; i < 60; i++) {
      const jitterLat = 37.7767 + (i * 0.000003 - 0.00009);
      const jitterLon = -122.4167 + ((i % 11) * 0.000004 - 0.00002);
      const r1 = cache.queryNaiveRawCoordinates(jitterLat, jitterLon, 500);
      const r2 = cache.queryTwoTierGeohashCache(jitterLat, jitterLon, 500);
      assert.equal(r1.length, 2);
      assert.equal(r2.length, 2);
    }

    // Raw coordinate cache misses on every single jittered GPS reading (0 hits / 60 requests)
    assert.equal(cache.naiveCoordHits, 0);
    assert.equal(cache.naiveCoordMisses, 60);

    // Two-tier Geohash cache hits on every cell lookup after the initial 9-cell warm-up!
    const geohashTotalLookups = cache.geohashCellHits + cache.geohashCellMisses;
    const geohashHitRatio = cache.geohashCellHits / geohashTotalLookups;
    assert.ok(geohashHitRatio > 0.95, `expected >95% geohash hit ratio, got ${geohashHitRatio}`);

    // Property test: Haversine is non-negative, symmetric, and satisfies the triangle inequality
    const coordArb = fc.record({
      lat: fc.double({ min: -85, max: 85, noNaN: true }),
      lon: fc.double({ min: -180, max: 180, noNaN: true }),
    });
    fc.assert(
      fc.property(coordArb, coordArb, coordArb, (p1, p2, p3) => {
        const d12 = haversineMeters(p1.lat, p1.lon, p2.lat, p2.lon);
        const d21 = haversineMeters(p2.lat, p2.lon, p1.lat, p1.lon);
        const d23 = haversineMeters(p2.lat, p2.lon, p3.lat, p3.lon);
        const d13 = haversineMeters(p1.lat, p1.lon, p3.lat, p3.lon);

        assert.ok(d12 >= 0);
        assert.ok(Math.abs(d12 - d21) < 1e-6);
        // Near antipodal points (a -> 1, ~20,015 km), IEEE-754 sqrt(1 - a) conditioning can vary by ~0.15 m
        assert.ok(d13 <= d12 + d23 + 0.5);
      }),
      { numRuns: 100 },
    );
  });

  it('estimateProximityCapacity verifies 100M DAU (~5,787 avg / ~28.9k peak QPS) and proves 200M-POI geohash index fits in single-node Valkey RAM without sharding', () => {
    const cap = estimateProximityCapacity({
      dau: 100_000_000,
      searchesPerUserPerDay: 5,
      peakMultiplier: 5,
      totalBusinesses: 200_000_000,
    });

    assert.ok(cap.avgSearchQps > 5_787 && cap.avgSearchQps < 5_788);
    assert.ok(cap.peakSearchQps > 28_935 && cap.peakSearchQps < 28_936);
    assert.equal(cap.businessTableGb, 200);
    assert.equal(cap.rawGeohashIndexGb, 4.8);
    assert.equal(cap.valkeyMultiPrecisionRamGb, 19.2);
    assert.equal(cap.fitsSingleValkeyNodeWithoutSharding, true);
  });
});
