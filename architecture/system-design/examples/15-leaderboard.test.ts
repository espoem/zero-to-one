import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  HashShardedLeaderboard,
  IdempotentScoreIngestor,
  RangeShardedLeaderboard,
  UntrustedScoreSubmissionError,
  decodeCompositeScore,
  encodeCompositeScore,
  encodeUnsafeOver53BitFloat,
  estimateLeaderboardSizing,
  signMatchOutcome,
} from './lib/leaderboard-models.ts';

describe('Module 21: Real-Time Gaming Leaderboard Executable Proofs', () => {
  const SEASON_START_MS = Date.parse('2026-11-01T00:00:00Z');

  it('53-bit IEEE-754 composite score ranks earlier achievers strictly higher and recovers exact scores, while >53-bit packing loses precision', () => {
    const tAlice = SEASON_START_MS + 10_000; // 10s into season
    const tBob = SEASON_START_MS + 10_005; // 10.005s into season (5 ms later)

    const compAlice = encodeCompositeScore(1_500, tAlice, SEASON_START_MS);
    const compBob = encodeCompositeScore(1_500, tBob, SEASON_START_MS);

    assert.ok(Number.isSafeInteger(compAlice));
    assert.ok(Number.isSafeInteger(compBob));
    // Alice achieved 1,500 points 5 ms earlier -> strictly higher composite score
    assert.ok(compAlice > compBob);

    assert.deepEqual(decodeCompositeScore(compAlice, SEASON_START_MS), {
      score: 1_500,
      achievedAtMs: tAlice,
    });
    assert.deepEqual(decodeCompositeScore(compBob, SEASON_START_MS), {
      score: 1_500,
      achievedAtMs: tBob,
    });

    // Negative test: naive >53-bit float packing (`score * 2^44 + invertedEpochMs`) overflows
    // `Number.MAX_SAFE_INTEGER` (2^53 - 1); at score = 15,000 (~2.64e17, ULP = 32), the 5 ms
    // difference rounds to the identical IEEE-754 float, collapsing tie-breaking!
    const unsafeAlice = encodeUnsafeOver53BitFloat(15_000, tAlice);
    const unsafeBob = encodeUnsafeOver53BitFloat(15_000, tBob);
    assert.equal(Number.isSafeInteger(unsafeAlice), false);
    assert.equal(unsafeAlice, unsafeBob); // 5 ms tie-breaker silently destroyed by IEEE-754 ULP rounding!
    assert.ok(
      encodeCompositeScore(15_000, tAlice, SEASON_START_MS) >
        encodeCompositeScore(15_000, tBob, SEASON_START_MS),
    );
  });

  it('HashShardedLeaderboard computes exact global rank via ZSCORE + parallel ZCOUNT and matches a single-node oracle 100% (fast-check)', () => {
    const cluster = new HashShardedLeaderboard({ shardCount: 8, seasonStartMs: SEASON_START_MS });
    const players = [
      { id: 'player-1', score: 500, ts: SEASON_START_MS + 1_000 },
      { id: 'player-2', score: 900, ts: SEASON_START_MS + 2_000 },
      { id: 'player-3', score: 900, ts: SEASON_START_MS + 1_500 }, // Ties 900 earlier than player-2 -> Rank 2
      { id: 'player-4', score: 1200, ts: SEASON_START_MS + 3_000 }, // Rank 1
      { id: 'player-5', score: 300, ts: SEASON_START_MS + 4_000 },
    ];

    for (const p of players) {
      cluster.upsertScore(p.id, p.score, p.ts);
    }

    const top3 = cluster.getTopK(3);
    assert.deepEqual(
      top3.map((e) => ({ userId: e.userId, score: e.score, rank: e.rank })),
      [
        { userId: 'player-4', score: 1200, rank: 1 },
        { userId: 'player-3', score: 900, rank: 2 },
        { userId: 'player-2', score: 900, rank: 3 },
      ],
    );

    assert.equal(cluster.getGlobalRank('player-4')?.rank, 1);
    assert.equal(cluster.getGlobalRank('player-3')?.rank, 2);
    assert.equal(cluster.getGlobalRank('player-2')?.rank, 3);
    assert.equal(cluster.getGlobalRank('player-1')?.rank, 4);
    assert.equal(cluster.getGlobalRank('player-5')?.rank, 5);

    // Negative test: querying local ZREVRANK on the owning shard alone misses higher players on other shards
    const brokenLocalRank = cluster.getBrokenLocalRankOnly('player-5')!;
    assert.ok(brokenLocalRank < 5, `expected broken local rank < 5, got ${brokenLocalRank}`);

    // Property test: 8-shard HashShardedLeaderboard matches 1-shard oracle across arbitrary score updates
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userIdx: fc.integer({ min: 1, max: 25 }),
            score: fc.integer({ min: 1, max: 50_000 }),
            elapsedMs: fc.integer({ min: 1, max: 1_000_000 }),
          }),
          { minLength: 5, maxLength: 50 },
        ),
        (updates) => {
          const sharded = new HashShardedLeaderboard({
            shardCount: 8,
            seasonStartMs: SEASON_START_MS,
          });
          const oracle = new HashShardedLeaderboard({
            shardCount: 1,
            seasonStartMs: SEASON_START_MS,
          });
          const seenUsers = new Set<string>();

          for (const u of updates) {
            const userId = `u-${u.userIdx}`;
            seenUsers.add(userId);
            sharded.upsertScore(userId, u.score, SEASON_START_MS + u.elapsedMs);
            oracle.upsertScore(userId, u.score, SEASON_START_MS + u.elapsedMs);
          }

          assert.deepEqual(sharded.getTopK(10), oracle.getTopK(10));
          for (const userId of seenUsers) {
            assert.deepEqual(sharded.getGlobalRank(userId), oracle.getGlobalRank(userId));
          }
        },
      ),
      { seed: 20261121, numRuns: 100 },
    );
  });

  it('RangeShardedLeaderboard serves Top-K from the highest shard, computes global rank via ZCARD prefix sums, and prevents ghost duplicates on boundary migration', () => {
    const brackets = [
      { id: 'tier-bronze', minScore: 0, maxScore: 100 },
      { id: 'tier-silver', minScore: 100, maxScore: 500 },
      { id: 'tier-gold', minScore: 500, maxScore: 1_000 },
      { id: 'tier-diamond', minScore: 1_000, maxScore: Number.POSITIVE_INFINITY },
    ];

    const rangeLb = new RangeShardedLeaderboard({ brackets, seasonStartMs: SEASON_START_MS });
    rangeLb.upsertScore('u-diamond-1', 1_250, SEASON_START_MS + 100);
    rangeLb.upsertScore('u-diamond-2', 1_100, SEASON_START_MS + 200);
    rangeLb.upsertScore('u-gold-1', 750, SEASON_START_MS + 300);
    rangeLb.upsertScore('u-bronze-climber', 90, SEASON_START_MS + 400);

    // Top-2 query touches ONLY the highest non-empty shard (`tier-diamond`, 1 shard queried out of 4!)
    const top2 = rangeLb.getTopK(2);
    assert.equal(top2.shardsQueried, 1);
    assert.deepEqual(
      top2.entries.map((e) => e.userId),
      ['u-diamond-1', 'u-diamond-2'],
    );
    assert.equal(rangeLb.getGlobalRank('u-bronze-climber')?.rank, 4);

    // Player `u-bronze-climber` wins a match and jumps from 90 (bronze) to 800 (gold)
    rangeLb.upsertScore('u-bronze-climber', 800, SEASON_START_MS + 500);
    assert.equal(rangeLb.getShardCardinalities().get('tier-bronze'), 0);
    assert.equal(rangeLb.getShardCardinalities().get('tier-gold'), 2);
    assert.equal(rangeLb.getGlobalRank('u-bronze-climber')?.rank, 3); // Above u-gold-1 (750)
    assert.equal(rangeLb.getGlobalRank('u-gold-1')?.rank, 4);

    // Negative test: if boundary migration omits ZREM from the old shard (`skipOldShardRemoveBug: true`),
    // a ghost duplicate remains in the old shard and inflates ZCARD counts!
    const buggyLb = new RangeShardedLeaderboard({ brackets, seasonStartMs: SEASON_START_MS });
    buggyLb.upsertScore('u-ghost', 600, SEASON_START_MS + 100); // Starts in gold
    buggyLb.upsertScore('u-victim', 200, SEASON_START_MS + 200); // In silver (true rank = 2)
    // u-ghost climbs to diamond (1,200) WITHOUT removing from gold -> ghost remains in gold!
    buggyLb.upsertScore('u-ghost', 1_200, SEASON_START_MS + 300, { skipOldShardRemoveBug: true });
    // Now diamond ZCARD = 1 AND gold ZCARD = 1 (ghost), so u-victim in silver gets false rank 3 instead of 2!
    assert.equal(buggyLb.getGlobalRank('u-victim')?.rank, 3);
  });

  it('IdempotentScoreIngestor rejects client-forged MITM score submissions and deduplicates retried match_ids', () => {
    const secret = 'game-server-hmac-secret-2026';
    const leaderboard = new HashShardedLeaderboard({
      shardCount: 4,
      seasonStartMs: SEASON_START_MS,
    });
    const ingestor = new IdempotentScoreIngestor({ serverSecret: secret, leaderboard });

    const matchEvent = {
      matchId: 'match-01972a40-0001',
      userId: 'player-alice',
      pointsDelta: 25,
      achievedAtMs: SEASON_START_MS + 50_000,
    };

    // Negative test: client MITM proxy attempts to submit 9,999 points with forged signature
    assert.throws(
      () =>
        ingestor.submitMatchScore({
          ...matchEvent,
          pointsDelta: 9_999,
          serverSignature: 'forged-client-proxy-signature',
        }),
      UntrustedScoreSubmissionError,
    );
    assert.equal(leaderboard.getGlobalRank('player-alice'), null);

    // Authoritative Game Server signs match outcome -> accepted
    const validSig = signMatchOutcome(matchEvent, secret);
    const first = ingestor.submitMatchScore({ ...matchEvent, serverSignature: validSig });
    assert.deepEqual(first, { newScore: 25, deduplicated: false });

    // Network retry of the same matchId -> deduplicated without double-awarding points
    const retry = ingestor.submitMatchScore({ ...matchEvent, serverSignature: validSig });
    assert.deepEqual(retry, { newScore: 25, deduplicated: true });
    assert.equal(leaderboard.getGlobalRank('player-alice')?.score, 25);
  });

  it('Capacity & ZSET memory model contrasts 5M vs 500M DAU QPS and proves 25M MAU requires ~3.2 GB active (~6.4 GB with 2x fork CoW) vs naive 650 MB', () => {
    const base5M = estimateLeaderboardSizing({
      dau: 5_000_000,
      mau: 25_000_000,
      matchesPerDauPerDay: 10,
      peakMultiplier: 5,
    });

    // 5,000,000 / 86,400 = 57.87 users/s (~50 rounded); * 10 matches = 578.70 QPS avg (~2,893.5 peak)
    assert.ok(base5M.avgActiveUsersPerSec > 57.8 && base5M.avgActiveUsersPerSec < 57.9);
    assert.ok(base5M.avgScoreWriteQps > 578.7 && base5M.avgScoreWriteQps < 578.8);
    assert.ok(base5M.peakScoreWriteQps > 2_893 && base5M.peakScoreWriteQps < 2_894);

    // Naive 26 B * 25M = 650 MB, whereas realistic 128 B/member = 3.2 GB active -> 6.4 GB with 2x CoW headroom
    assert.equal(base5M.naivePayloadMemoryMb, 650);
    assert.equal(base5M.realisticZsetActiveGb, 3.2);
    assert.equal(base5M.recommendedCowProvisionedGb, 6.4);

    // 100x DAU scale-out (500M DAU / 500M active seasonal members): ~289,351 peak write QPS,
    // 64.0 GB active ZSET state (128.0 GB with 2x CoW headroom) -> requires multi-shard partitioning
    const scale500M = estimateLeaderboardSizing({
      dau: 500_000_000,
      mau: 500_000_000,
      matchesPerDauPerDay: 10,
      peakMultiplier: 5,
    });
    assert.ok(scale500M.peakScoreWriteQps > 289_350 && scale500M.peakScoreWriteQps < 289_353);
    assert.equal(scale500M.realisticZsetActiveGb, 64);
    assert.equal(scale500M.recommendedCowProvisionedGb, 128);
  });
});
