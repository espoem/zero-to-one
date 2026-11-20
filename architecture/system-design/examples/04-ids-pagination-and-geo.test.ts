import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ClockMovedBackwardsError,
  encodeGeohash,
  FakeClock,
  geohashNeighbors,
  InMemoryFeedTable,
  SnowflakeGenerator,
} from './lib/system-design-models.ts';

test('SnowflakeGenerator produces unique monotonic 64-bit IDs across 4096/ms sequence rollover', () => {
  const clock = new FakeClock(1_750_000_000_000);
  const gen = new SnowflakeGenerator({
    nodeId: 42,
    clock,
    onSequenceExhausted: () => {
      clock.advance(1);
    },
  });

  const ids = new Set<bigint>();
  let prev = -1n;
  // Generate 5,000 IDs starting in the same ms -> forces 4096/ms rollover into next ms
  for (let i = 0; i < 5_000; i += 1) {
    const id = gen.nextId();
    assert.ok(id > prev, `ID ${id} must be strictly greater than ${prev}`);
    assert.equal(ids.has(id), false, 'Duplicate Snowflake ID detected');
    ids.add(id);
    prev = id;
  }

  assert.equal(ids.size, 5_000);
  assert.equal(clock.now(), 1_750_000_000_001);
});

test('Negative test: NTP clock step backwards throws ClockMovedBackwardsError instead of emitting duplicates', () => {
  const clock = new FakeClock(1_750_000_000_000);
  const gen = new SnowflakeGenerator({
    nodeId: 7,
    clock,
    maxBackwardToleranceMs: 2,
  });

  const first = gen.nextId();
  clock.advance(10);
  const second = gen.nextId();
  assert.ok(second > first);

  // Small drift within 2ms tolerance is absorbed safely without duplicates
  clock.advance(-1);
  const tolerated = gen.nextId();
  assert.ok(tolerated > second);

  // Large NTP backward step (50ms > 2ms) throws ClockMovedBackwardsError
  clock.advance(-50);
  assert.throws(() => gen.nextId(), ClockMovedBackwardsError);
});

test('Negative test: Offset pagination duplicates rows on concurrent inserts while Keyset returns exact items', () => {
  const table = new InMemoryFeedTable();
  for (let id = 1; id <= 10; id += 1) {
    table.insert({ id, createdAt: 1_000 + id, payload: `post-${id}` });
  }

  // Page 1 (top 5 newest: ids 10, 9, 8, 7, 6)
  const offsetPage1 = table.queryOffset(5, 0);
  const keysetPage1 = table.queryKeyset(5);
  assert.deepEqual(
    offsetPage1.map((r) => r.id),
    [10, 9, 8, 7, 6],
  );
  assert.deepEqual(
    keysetPage1.items.map((r) => r.id),
    [10, 9, 8, 7, 6],
  );

  // 2 new rows inserted before client requests page 2
  table.insert({ id: 11, createdAt: 1_011, payload: 'post-11' });
  table.insert({ id: 12, createdAt: 1_012, payload: 'post-12' });

  // Offset pagination shifts and duplicates ids 7 and 6!
  const offsetPage2 = table.queryOffset(5, 5);
  const offsetIds = [...offsetPage1, ...offsetPage2].map((r) => r.id);
  const offsetUnique = new Set(offsetIds);
  assert.ok(offsetUnique.size < offsetIds.length, 'Offset pagination must produce duplicate rows');
  assert.deepEqual(
    offsetPage2.map((r) => r.id),
    [7, 6, 5, 4, 3],
  );

  // Keyset pagination yields remaining original items [5, 4, 3, 2, 1] with zero duplicates or skips
  const keysetPage2 = table.queryKeyset(5, keysetPage1.nextCursor);
  const combinedKeyset = [...keysetPage1.items, ...keysetPage2.items].map((r) => r.id);
  assert.deepEqual(combinedKeyset, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(new Set(combinedKeyset).size, 10);
});

test('Negative test: Geohash single-cell query misses nearby boundary neighbor; 8-neighbor expansion finds it', () => {
  // Two points ~22m apart straddling the (0, 0) equator/prime-meridian cell boundary
  const driver = { lat: 0.0001, lon: 0.0001 };
  const rider = { lat: -0.0001, lon: -0.0001 };

  const driverCell = encodeGeohash(driver.lat, driver.lon, 6);
  const riderCell = encodeGeohash(rider.lat, rider.lon, 6);

  assert.notEqual(driverCell, riderCell);
  assert.notEqual(driverCell[0], riderCell[0], 'Adjacent points across (0,0) share zero prefix');

  // Single-cell prefix lookup misses the nearby driver
  const singleCellCandidates = new Set([riderCell]);
  assert.equal(singleCellCandidates.has(driverCell), false);

  // 8-neighbor cell expansion captures the adjacent cell
  const expandedCells = new Set([riderCell, ...geohashNeighbors(riderCell)]);
  assert.equal(expandedCells.size, 9);
  assert.equal(expandedCells.has(driverCell), true);
});
