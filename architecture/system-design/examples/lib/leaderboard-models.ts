/**
 * Executable models for Module 21: Real-Time Gaming Leaderboard (ByteByteGo Ch. 25).
 * Covers:
 *  1. IEEE-754 53-bit safe integer composite score encoding (`21-bit score` + `32-bit inverted relative ms`)
 *     for deterministic earliest-achiever tie-breaking vs naive >53-bit float precision collapse
 *  2. Hash-Sharded Leaderboard (Valkey/Redis Cluster `hash(user_id) % S`): Top-K scatter-gather
 *     and exact global rank via `ZSCORE` + parallel `ZCOUNT` (vs broken naive `ZREVRANK` sum)
 *  3. Score-Range Sharded Leaderboard (`[0..100)`, `[100..500)`, ...): `ZCARD`-based global rank
 *     and atomic cross-shard boundary migration preventing ghost duplicate entries
 *  4. Server-authoritative anti-cheat score ingestion (`HMAC-SHA256` signature + idempotent `match_id`)
 *  5. Capacity & realistic Valkey ZSET memory sizing (`128 B/member` skiplist+dict + `2x` `fork()` CoW headroom)
 */

import { createHmac } from 'node:crypto';

const TWO_POW_32 = 4_294_967_296; // 2^32 (~49.71 days in milliseconds)
const MAX_SAFE_21_BIT_SCORE = 2_097_151; // 2^21 - 1 (21 + 32 = 53 exact IEEE-754 significand bits)
const MAX_REL_MS = TWO_POW_32 - 1;

/**
 * Encodes an integer game `score` (`0..2,097,151`) and millisecond timestamp relative to
 * `seasonStartMs` (`0..4,294,967,295 ms`, ~49.7 days) into an exact 53-bit IEEE-754 integer float.
 * Earlier achievers have a smaller `elapsedMs`, yielding a strictly larger `(MAX_REL_MS - elapsedMs)`
 * low-order tie-breaker and ranking higher in descending `ZREVRANGE` / `ZREVRANK` order.
 */
export function encodeCompositeScore(
  score: number,
  achievedAtMs: number,
  seasonStartMs: number,
): number {
  if (!Number.isInteger(score) || score < 0 || score > MAX_SAFE_21_BIT_SCORE) {
    throw new RangeError(`score must be an integer in [0, ${MAX_SAFE_21_BIT_SCORE}]`);
  }
  const elapsedMs = Math.floor(achievedAtMs - seasonStartMs);
  if (elapsedMs < 0 || elapsedMs > MAX_REL_MS) {
    throw new RangeError(`elapsedMs must be in [0, ${MAX_REL_MS}]`);
  }
  const invertedTieBreaker = MAX_REL_MS - elapsedMs;
  return score * TWO_POW_32 + invertedTieBreaker;
}

/**
 * Recovers the exact integer game score and achievement timestamp from a 53-bit composite score.
 */
export function decodeCompositeScore(
  compositeScore: number,
  seasonStartMs: number,
): { score: number; achievedAtMs: number } {
  const score = Math.floor(compositeScore / TWO_POW_32);
  const invertedTieBreaker = compositeScore - score * TWO_POW_32;
  const elapsedMs = MAX_REL_MS - invertedTieBreaker;
  return { score, achievedAtMs: seasonStartMs + elapsedMs };
}

/**
 * Negative-test helper demonstrating the classic >53-bit IEEE-754 float trap:
 * multiplying `score` by `2^44` and adding a 44-bit epoch millisecond timestamp
 * exceeds `Number.MAX_SAFE_INTEGER` (`2^53 - 1`), silently rounding low timestamp bits!
 */
export function encodeUnsafeOver53BitFloat(score: number, rawEpochMs: number): number {
  const twoPow44 = 17_592_186_044_416; // 2^44
  return score * twoPow44 + (twoPow44 - 1 - rawEpochMs);
}

interface LeaderboardEntry {
  readonly userId: string;
  readonly score: number;
  readonly compositeScore: number;
  readonly rank: number; // 1-based global rank
}

function compareCompositeDesc(
  a: { userId: string; compositeScore: number },
  b: { userId: string; compositeScore: number },
): number {
  if (b.compositeScore !== a.compositeScore) {
    return b.compositeScore - a.compositeScore;
  }
  // Valkey/Redis ZREVRANGE tie-breaks identical float scores in reverse lexicographical order
  return b.userId.localeCompare(a.userId);
}

function hashUserIdToShard(userId: string, shardCount: number): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % shardCount;
}

/**
 * Hash-Sharded Leaderboard (modeling Valkey / Redis Cluster `hash(user_id) % shardCount`).
 *  - Writes route to 1 owning shard in O(log N_shard).
 *  - `getTopK(k)` scatter-gathers top `k` from each shard and merges.
 *  - `getGlobalRank(userId)` fetches `ZSCORE` on the owning shard, then sums parallel
 *    `ZCOUNT` of strictly higher entries across all shards.
 */
export class HashShardedLeaderboard {
  readonly shardCount: number;
  readonly seasonStartMs: number;
  private readonly shards: Array<Map<string, number>>;

  constructor(options: { shardCount: number; seasonStartMs: number }) {
    if (options.shardCount < 1) throw new RangeError('shardCount must be >= 1');
    this.shardCount = options.shardCount;
    this.seasonStartMs = options.seasonStartMs;
    this.shards = Array.from({ length: options.shardCount }, () => new Map<string, number>());
  }

  upsertScore(userId: string, newScore: number, achievedAtMs: number): number {
    const shardIdx = hashUserIdToShard(userId, this.shardCount);
    const composite = encodeCompositeScore(newScore, achievedAtMs, this.seasonStartMs);
    this.shards[shardIdx]!.set(userId, composite);
    return composite;
  }

  incrementScore(userId: string, deltaPoints: number, achievedAtMs: number): number {
    const shardIdx = hashUserIdToShard(userId, this.shardCount);
    const shard = this.shards[shardIdx]!;
    const existingComposite = shard.get(userId);
    const currentScore =
      existingComposite !== undefined
        ? decodeCompositeScore(existingComposite, this.seasonStartMs).score
        : 0;
    const nextScore = currentScore + deltaPoints;
    const nextComposite = encodeCompositeScore(nextScore, achievedAtMs, this.seasonStartMs);
    shard.set(userId, nextComposite);
    return nextScore;
  }

  /**
   * Computes exact 1-based global rank across hash-sharded ZSETs:
   *  1. Fetch `compositeScore = ZSCORE owning_shard user_id`
   *  2. On every shard `i`, count members strictly outranking `(userId, compositeScore)`
   *     (`ZCOUNT shard_i (compositeScore +inf`, plus reverse-lexicographical tie-break)
   *  3. Global rank = `1 + sum(higherCount_i)`
   */
  getGlobalRank(userId: string): LeaderboardEntry | null {
    const owningShardIdx = hashUserIdToShard(userId, this.shardCount);
    const compositeScore = this.shards[owningShardIdx]!.get(userId);
    if (compositeScore === undefined) return null;

    let strictlyHigherCount = 0;
    for (const shard of this.shards) {
      for (const [otherId, otherComposite] of shard.entries()) {
        if (otherId === userId) continue;
        if (
          otherComposite > compositeScore ||
          (otherComposite === compositeScore && otherId.localeCompare(userId) > 0)
        ) {
          strictlyHigherCount++;
        }
      }
    }

    const { score } = decodeCompositeScore(compositeScore, this.seasonStartMs);
    return {
      userId,
      score,
      compositeScore,
      rank: 1 + strictlyHigherCount,
    };
  }

  /**
   * Negative-test method demonstrating the broken `ZREVRANK`-summation anti-pattern:
   * querying `ZREVRANK shard_i user_id` returns `null` on all `S - 1` shards that do not
   * hold `user_id` (and local rank on the owning shard ignores higher players on other shards!).
   */
  getBrokenLocalRankOnly(userId: string): number | null {
    const owningShardIdx = hashUserIdToShard(userId, this.shardCount);
    const shard = this.shards[owningShardIdx]!;
    const compositeScore = shard.get(userId);
    if (compositeScore === undefined) return null;

    let localHigher = 0;
    for (const [otherId, otherComposite] of shard.entries()) {
      if (otherId === userId) continue;
      if (
        otherComposite > compositeScore ||
        (otherComposite === compositeScore && otherId.localeCompare(userId) > 0)
      ) {
        localHigher++;
      }
    }
    return 1 + localHigher;
  }

  getTopK(k: number): LeaderboardEntry[] {
    const candidates: Array<{ userId: string; compositeScore: number }> = [];
    for (const shard of this.shards) {
      const shardSorted = Array.from(shard.entries(), ([userId, compositeScore]) => ({
        userId,
        compositeScore,
      }))
        .sort(compareCompositeDesc)
        .slice(0, k);
      candidates.push(...shardSorted);
    }

    return candidates
      .sort(compareCompositeDesc)
      .slice(0, k)
      .map((item, idx) => ({
        userId: item.userId,
        score: decodeCompositeScore(item.compositeScore, this.seasonStartMs).score,
        compositeScore: item.compositeScore,
        rank: idx + 1,
      }));
  }
}

interface ScoreRangeBracket {
  readonly id: string;
  readonly minScore: number; // inclusive
  readonly maxScore: number; // exclusive (or +Infinity for top shard)
}

/**
 * Score-Range Sharded Leaderboard (partitioning players into disjoint score brackets).
 *  - `getTopK(k)` queries starting from the highest score bracket down, avoiding full scatter-gather.
 *  - `getGlobalRank(userId)` computes `local ZREVRANK + sum(ZCARD of all strictly higher brackets)`.
 *  - `upsertScore` atomically removes (`ZREM`) the user from their previous bracket when crossing
 *    a score threshold so ghost duplicate entries can never inflate `ZCARD`.
 */
export class RangeShardedLeaderboard {
  readonly brackets: readonly ScoreRangeBracket[];
  readonly seasonStartMs: number;
  private readonly shardMembers = new Map<string, Map<string, number>>();
  private readonly userToBracketId = new Map<string, string>();

  constructor(options: { brackets: readonly ScoreRangeBracket[]; seasonStartMs: number }) {
    if (options.brackets.length === 0) throw new RangeError('At least one bracket is required');
    // Sort brackets descending by minScore (highest score shard first)
    this.brackets = [...options.brackets].sort((a, b) => b.minScore - a.minScore);
    this.seasonStartMs = options.seasonStartMs;
    for (const b of this.brackets) {
      this.shardMembers.set(b.id, new Map<string, number>());
    }
  }

  private resolveBracket(score: number): ScoreRangeBracket {
    for (const b of this.brackets) {
      if (score >= b.minScore && score < b.maxScore) {
        return b;
      }
    }
    throw new RangeError(`No score bracket covers score=${score}`);
  }

  upsertScore(
    userId: string,
    newScore: number,
    achievedAtMs: number,
    options: { skipOldShardRemoveBug?: boolean } = {},
  ): void {
    const targetBracket = this.resolveBracket(newScore);
    const prevBracketId = this.userToBracketId.get(userId);

    if (
      prevBracketId !== undefined &&
      prevBracketId !== targetBracket.id &&
      !options.skipOldShardRemoveBug
    ) {
      // Atomic boundary migration: ZREM from old score-range shard before ZADD to new shard
      this.shardMembers.get(prevBracketId)?.delete(userId);
    }

    const composite = encodeCompositeScore(newScore, achievedAtMs, this.seasonStartMs);
    this.shardMembers.get(targetBracket.id)!.set(userId, composite);
    this.userToBracketId.set(userId, targetBracket.id);
  }

  /**
   * Returns `ZCARD` (member count) of each score-range shard.
   */
  getShardCardinalities(): ReadonlyMap<string, number> {
    const out = new Map<string, number>();
    for (const b of this.brackets) {
      out.set(b.id, this.shardMembers.get(b.id)!.size);
    }
    return out;
  }

  getGlobalRank(userId: string): LeaderboardEntry | null {
    const bracketId = this.userToBracketId.get(userId);
    if (!bracketId) return null;

    let higherShardsZcardSum = 0;
    for (const b of this.brackets) {
      if (b.id === bracketId) break;
      // O(1) ZCARD lookup on each higher score-range shard (NOT `INFO keyspace`!)
      higherShardsZcardSum += this.shardMembers.get(b.id)!.size;
    }

    const localShard = this.shardMembers.get(bracketId)!;
    const compositeScore = localShard.get(userId)!;
    let localHigher = 0;
    for (const [otherId, otherComposite] of localShard.entries()) {
      if (otherId === userId) continue;
      if (
        otherComposite > compositeScore ||
        (otherComposite === compositeScore && otherId.localeCompare(userId) > 0)
      ) {
        localHigher++;
      }
    }

    const { score } = decodeCompositeScore(compositeScore, this.seasonStartMs);
    return {
      userId,
      score,
      compositeScore,
      rank: 1 + higherShardsZcardSum + localHigher,
    };
  }

  getTopK(k: number): { entries: LeaderboardEntry[]; shardsQueried: number } {
    const results: LeaderboardEntry[] = [];
    let shardsQueried = 0;

    // Query starting from the highest score bracket; stop as soon as k players are collected!
    for (const b of this.brackets) {
      const shard = this.shardMembers.get(b.id)!;
      if (shard.size === 0) continue;
      shardsQueried++;
      const sorted = Array.from(shard.entries(), ([userId, compositeScore]) => ({
        userId,
        compositeScore,
      })).sort(compareCompositeDesc);

      for (const item of sorted) {
        results.push({
          userId: item.userId,
          score: decodeCompositeScore(item.compositeScore, this.seasonStartMs).score,
          compositeScore: item.compositeScore,
          rank: results.length + 1,
        });
        if (results.length >= k) {
          return { entries: results, shardsQueried };
        }
      }
    }

    return { entries: results, shardsQueried };
  }
}

export class UntrustedScoreSubmissionError extends Error {
  constructor(matchId: string) {
    super(
      `UntrustedScoreSubmissionError: matchId ${matchId} failed game-server HMAC signature verification`,
    );
    this.name = 'UntrustedScoreSubmissionError';
  }
}

interface SignedMatchSubmission {
  readonly matchId: string;
  readonly userId: string;
  readonly pointsDelta: number;
  readonly achievedAtMs: number;
  readonly serverSignature: string;
}

/**
 * Computes the authoritative Game Server HMAC-SHA256 signature over a match outcome.
 */
export function signMatchOutcome(
  params: Omit<SignedMatchSubmission, 'serverSignature'>,
  serverSecret: string,
): string {
  const payload = `${params.matchId}|${params.userId}|${params.pointsDelta}|${params.achievedAtMs}`;
  return createHmac('sha256', serverSecret).update(payload).digest('hex');
}

/**
 * Anti-cheat score ingestion boundary:
 *  - Rejects direct client score submissions lacking a valid Game Server HMAC signature
 *  - Deduplicates retried `matchId` events so network retries never double-award points
 */
export class IdempotentScoreIngestor {
  private readonly serverSecret: string;
  private readonly leaderboard: HashShardedLeaderboard;
  private readonly processedMatches = new Map<string, number>(); // matchId -> resultingScore

  constructor(options: { serverSecret: string; leaderboard: HashShardedLeaderboard }) {
    this.serverSecret = options.serverSecret;
    this.leaderboard = options.leaderboard;
  }

  submitMatchScore(sub: SignedMatchSubmission): {
    newScore: number;
    deduplicated: boolean;
  } {
    const expectedSig = signMatchOutcome(sub, this.serverSecret);
    if (sub.serverSignature !== expectedSig) {
      throw new UntrustedScoreSubmissionError(sub.matchId);
    }

    const existingScore = this.processedMatches.get(sub.matchId);
    if (existingScore !== undefined) {
      return { newScore: existingScore, deduplicated: true };
    }

    const newScore = this.leaderboard.incrementScore(sub.userId, sub.pointsDelta, sub.achievedAtMs);
    this.processedMatches.set(sub.matchId, newScore);
    return { newScore, deduplicated: false };
  }
}

interface LeaderboardSizingEstimate {
  readonly avgActiveUsersPerSec: number;
  readonly peakActiveUsersPerSec: number;
  readonly avgScoreWriteQps: number;
  readonly peakScoreWriteQps: number;
  readonly naivePayloadMemoryMb: number;
  readonly realisticZsetActiveGb: number;
  readonly recommendedCowProvisionedGb: number;
}

/**
 * Quantitative capacity and Valkey/Redis ZSET memory sizing calculator contrasting
 * naive payload byte summation (26 B/member) with real 64-bit skiplist + dict node
 * overhead (~128 B/member) plus 2x `fork()` Copy-on-Write RDB/AOF snapshot headroom.
 */
export function estimateLeaderboardSizing(options: {
  dau: number;
  mau: number;
  matchesPerDauPerDay: number;
  peakMultiplier: number;
  naiveBytesPerMember?: number;
  realisticZsetBytesPerMember?: number;
  cowHeadroomMultiplier?: number;
}): LeaderboardSizingEstimate {
  const naiveBytes = options.naiveBytesPerMember ?? 26;
  const realisticBytes = options.realisticZsetBytesPerMember ?? 128;
  const cowFactor = options.cowHeadroomMultiplier ?? 2;

  const avgActiveUsersPerSec = options.dau / 86_400;
  const peakActiveUsersPerSec = avgActiveUsersPerSec * options.peakMultiplier;
  const avgScoreWriteQps = (options.dau * options.matchesPerDauPerDay) / 86_400;
  const peakScoreWriteQps = avgScoreWriteQps * options.peakMultiplier;

  const naivePayloadMemoryMb = (options.mau * naiveBytes) / 1e6;
  const realisticZsetActiveGb = (options.mau * realisticBytes) / 1e9;
  const recommendedCowProvisionedGb = realisticZsetActiveGb * cowFactor;

  return {
    avgActiveUsersPerSec,
    peakActiveUsersPerSec,
    avgScoreWriteQps,
    peakScoreWriteQps,
    naivePayloadMemoryMb,
    realisticZsetActiveGb,
    recommendedCowProvisionedGb,
  };
}
