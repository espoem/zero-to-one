import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  SuperTileRoutingIndex,
  ancestorTile,
  estimateLocationBatching,
  latLonToTile,
  shortestPathAStar,
  snapGpsPoint,
  tilePyramidStats,
  type RoadEdge,
  type RoadNode,
} from './lib/maps-models.ts';

describe('Module 17: Google Maps Executable Proofs', () => {
  it('Web Mercator projection computes exact zoom-pyramid coordinates and proves z=21 raw raster storage exceeds 400 PB', () => {
    // San Francisco (37.7749, -122.4194) at zoom 0 is always (0, 0)
    assert.deepEqual(latLonToTile(37.7749, -122.4194, 0), { z: 0, x: 0, y: 0 });
    // At zoom 10, SF sits in tile (163, 395)
    const sf10 = latLonToTile(37.7749, -122.4194, 10);
    assert.deepEqual(sf10, { z: 10, x: 163, y: 395 });

    // Property: zooming out by 1 always halves (x, y) via integer right shift (quadtree invariant)
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179.9, max: 179.9, noNaN: true }),
        fc.integer({ min: 1, max: 20 }),
        (lat, lon, z) => {
          const child = latLonToTile(lat, lon, z);
          const parent = latLonToTile(lat, lon, z - 1);
          assert.deepEqual(ancestorTile(child, z - 1), parent);
        },
      ),
      { seed: 20261121, numRuns: 200 },
    );

    // Zoom 21 pyramid sizing at 100 KB per uncompressed raster tile
    const z21 = tilePyramidStats(21, 100_000);
    assert.equal(z21.tilesAtMaxZoom, 4_398_046_511_104n); // ~4.40 trillion tiles
    // ~439.8 PB raw at z=21 alone -> proves sparse ocean deduplication + vector tiles are mandatory
    const pbAtZ21 = Number(z21.uncompressedBytesAtMaxZoom / 1_000_000_000_000n) / 1000;
    assert.ok(pbAtZ21 > 439 && pbAtZ21 < 441, `expected ~439.8 PB, got ${pbAtZ21}`);
  });

  it('A* visits fewer road vertices than Dijkstra and dynamically reroutes onto arterial bypass on 10x highway incident', () => {
    const nodes = new Map<string, RoadNode>([
      ['Origin', { id: 'Origin', xKm: 0, yKm: 0 }],
      ['Hwy1', { id: 'Hwy1', xKm: 10, yKm: 0 }],
      ['Hwy2', { id: 'Hwy2', xKm: 20, yKm: 0 }],
      ['Art1', { id: 'Art1', xKm: 10, yKm: 4 }],
      ['Art2', { id: 'Art2', xKm: 20, yKm: 4 }],
      ['DeadWest1', { id: 'DeadWest1', xKm: -8, yKm: 0 }],
      ['DeadWest2', { id: 'DeadWest2', xKm: -16, yKm: 0 }],
      ['DeadSouth', { id: 'DeadSouth', xKm: 0, yKm: -9 }],
      ['Dest', { id: 'Dest', xKm: 30, yKm: 0 }],
    ]);

    const buildGraph = (highwayCongestion: number): Map<string, RoadEdge[]> =>
      new Map<string, RoadEdge[]>([
        [
          'Origin',
          [
            { to: 'Hwy1', distanceKm: 10, speedKmh: 100 },
            { to: 'Art1', distanceKm: 11, speedKmh: 60 },
            { to: 'DeadWest1', distanceKm: 8, speedKmh: 100 },
            { to: 'DeadSouth', distanceKm: 9, speedKmh: 100 },
          ],
        ],
        ['DeadWest1', [{ to: 'DeadWest2', distanceKm: 8, speedKmh: 100 }]],
        [
          'Hwy1',
          [{ to: 'Hwy2', distanceKm: 10, speedKmh: 100, congestionMultiplier: highwayCongestion }],
        ],
        ['Hwy2', [{ to: 'Dest', distanceKm: 10, speedKmh: 100 }]],
        ['Art1', [{ to: 'Art2', distanceKm: 10, speedKmh: 60 }]],
        ['Art2', [{ to: 'Dest', distanceKm: 11, speedKmh: 60 }]],
      ]);

    const freeFlowGraph = buildGraph(1.0);
    const dijkstra = shortestPathAStar({
      nodes,
      adjacency: freeFlowGraph,
      origin: 'Origin',
      destination: 'Dest',
      maxSpeedKmh: Number.POSITIVE_INFINITY, // h(n) = 0 -> pure Dijkstra
    });
    const aStar = shortestPathAStar({
      nodes,
      adjacency: freeFlowGraph,
      origin: 'Origin',
      destination: 'Dest',
      maxSpeedKmh: 100, // admissible upper-bound highway speed
    });

    assert.deepEqual(aStar.path, ['Origin', 'Hwy1', 'Hwy2', 'Dest']);
    assert.equal(aStar.travelTimeMinutes, 18); // 30 km @ 100 km/h = 18 min
    assert.equal(dijkstra.travelTimeMinutes, aStar.travelTimeMinutes);
    assert.ok(
      aStar.visitedNodes < dijkstra.visitedNodes,
      `expected A* (${aStar.visitedNodes}) < Dijkstra (${dijkstra.visitedNodes})`,
    );

    // Live traffic incident spikes Hwy1->Hwy2 delay 10x (6 min -> 60 min): CRP/A* reroutes onto Arterial bypass (32 min)
    const incidentGraph = buildGraph(10.0);
    const rerouted = shortestPathAStar({
      nodes,
      adjacency: incidentGraph,
      origin: 'Origin',
      destination: 'Dest',
      maxSpeedKmh: 100,
    });
    assert.deepEqual(rerouted.path, ['Origin', 'Art1', 'Art2', 'Dest']);
    assert.equal(rerouted.travelTimeMinutes, 32); // 32 km @ 60 km/h = 32 min << 72 min congested highway
  });

  it('Hierarchical super-tile index bounds chain to <= z+1 entries and two-stage lookup separates exact impacted users', () => {
    const index = new SuperTileRoutingIndex();
    const sfOrigin = latLonToTile(37.7749, -122.4194, 14);
    const oaklandDest = latLonToTile(37.8044, -122.2712, 14);
    const marinDest = latLonToTile(37.8591, -122.4853, 14);
    const nycOrigin = latLonToTile(40.7128, -74.006, 14);
    const brooklynDest = latLonToTile(40.6782, -73.9442, 14);

    const bayChain = index.registerNavigator('driver-bay', sfOrigin, oaklandDest, [
      'sf-market',
      'i80-bay-bridge',
      'oakland-grand',
    ]);
    index.registerNavigator('driver-golden-gate', sfOrigin, marinDest, [
      'sf-van-ness',
      'us101-golden-gate',
    ]);
    index.registerNavigator('driver-nyc', nycOrigin, brooklynDest, ['manhattan-bridge']);

    // Chain length = z_base - z_enclosing + 1 <= z_base + 1 (8 for SF->Oakland at z=14)
    assert.ok(
      bayChain.length >= 2 && bayChain.length <= 15,
      `unexpected chain len ${bayChain.length}`,
    );
    assert.equal(index.storedTilesForUser('driver-bay'), bayChain.length);

    // Stage 1 coarse super-tile prefilter returns Bay Area candidates and excludes driver-nyc
    const bayBridgeIncident = latLonToTile(37.7983, -122.3778, 14);
    const candidates = index.findCandidateUsers(bayBridgeIncident);
    assert.ok(candidates.includes('driver-bay'));
    assert.ok(!candidates.includes('driver-nyc'));

    // Stage 2 exact route-edge verification isolates driver-bay and filters out driver-golden-gate
    assert.deepEqual(index.findImpactedUsers(bayBridgeIncident, 'i80-bay-bridge'), ['driver-bay']);
  });

  it('15-second client telemetry batching cuts 1B DAU navigation QPS by 15x to ~231k avg / ~1.16M peak', () => {
    const metrics = estimateLocationBatching({
      dau: 1_000_000_000,
      weeklyNavMinutesPerUser: 35,
      sampleIntervalSec: 1,
      batchIntervalSec: 15,
      peakMultiplier: 5,
    });

    assert.equal(metrics.qpsReductionFactor, 15);
    assert.ok(
      metrics.avgRawSamplesPerSec > 3_400_000 && metrics.avgRawSamplesPerSec < 3_500_000,
      `expected ~3.47M raw GPS samples/s, got ${metrics.avgRawSamplesPerSec}`,
    );
    assert.ok(
      metrics.avgBatchedQps > 220_000 && metrics.avgBatchedQps < 245_000,
      `expected ~231k avg batched QPS, got ${metrics.avgBatchedQps}`,
    );
    assert.ok(
      metrics.peakBatchedQps > 1_100_000 && metrics.peakBatchedQps < 1_200_000,
      `expected ~1.16M peak batched QPS, got ${metrics.peakBatchedQps}`,
    );
  });

  it('Negative test: Naive Euclidean GPS snapping falsely jumps onto a perpendicular overpass while heading/continuity matching locks onto the highway', () => {
    // Vehicle driving East (90 deg) on I-80; urban GPS drifts 6 m closer to a perpendicular North-South overpass (0 deg)
    const candidates = [
      { roadId: 'overpass-ns', distanceMeters: 4, roadHeadingDeg: 0, sameRoadAsPrevious: false },
      { roadId: 'highway-i80-e', distanceMeters: 10, roadHeadingDeg: 92, sameRoadAsPrevious: true },
    ];

    // Negative proof: naive Euclidean snapping jumps falsely onto the overpass!
    assert.equal(
      snapGpsPoint({ vehicleHeadingDeg: 90, candidates, mode: 'naive-euclidean' }),
      'overpass-ns',
    );

    // HMM emission + heading + continuity penalty keeps the driver locked on highway-i80-e
    assert.equal(
      snapGpsPoint({ vehicleHeadingDeg: 90, candidates, mode: 'hmm-heading-continuity' }),
      'highway-i80-e',
    );
  });
});
