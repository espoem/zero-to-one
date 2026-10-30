import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Byzantine Fault Tolerance mathematical bound verification:
 * Checks whether N nodes can tolerate f Byzantine failures and f crash failures.
 */
export function canTolerateByzantine(N: number, f: number): boolean {
  // Liveness requires acting on N - f responses.
  // Within those N - f responses, at most f could be Byzantine liars.
  // For honest nodes to strictly outvote traitors: (N - 2f) > f => N >= 3f + 1
  const honestRespondents = N - 2 * f;
  return honestRespondents > f;
}

/**
 * PBFT 3-Phase State Machine Simulator.
 */
export class PbftNode {
  readonly id: number;
  readonly N: number;
  readonly f: number;

  prepared = false;
  committed = false;

  private readonly prepareVotes = new Set<number>();
  private readonly commitVotes = new Set<number>();

  constructor(id: number, totalNodes = 4) {
    this.id = id;
    this.N = totalNodes;
    this.f = Math.floor((totalNodes - 1) / 3);
  }

  // Phase 1: Pre-Prepare from primary
  handlePrePrepare(view: number, seq: number, digest: string): boolean {
    return view >= 0 && seq >= 0 && digest.length > 0;
  }

  // Phase 2: Prepare from backups
  handlePrepare(fromNode: number, digest: string, expectedDigest: string): boolean {
    if (digest !== expectedDigest) return false;
    this.prepareVotes.add(fromNode);
    // Requires 2f prepare messages from distinct backups
    if (this.prepareVotes.size >= 2 * this.f) {
      this.prepared = true;
    }
    return this.prepared;
  }

  // Phase 3: Commit
  handleCommit(fromNode: number, digest: string, expectedDigest: string): boolean {
    if (digest !== expectedDigest) return false;
    this.commitVotes.add(fromNode);
    // Requires 2f + 1 commit messages
    if (this.commitVotes.size >= 2 * this.f + 1) {
      this.committed = true;
    }
    return this.committed;
  }
}

test('Module 13: Byzantine Fault Tolerance & the 3f + 1 Bound', async (t) => {
  await t.test('Mathematical 3f + 1 bound: 2f + 1 fails, 3f + 1 succeeds for Byzantine tolerance', () => {
    // For f = 1 traitor:
    // 2f + 1 = 3 nodes: FAILS (1 crash + 1 traitor leaves 1 honest node, tied 1 vs 1)
    assert.equal(canTolerateByzantine(3, 1), false);

    // 3f + 1 = 4 nodes: SUCCEEDS ((4 - 2) = 2 honest nodes > 1 traitor)
    assert.equal(canTolerateByzantine(4, 1), true);

    // For f = 2 traitors:
    // 2f + 1 = 5 nodes: FAILS
    assert.equal(canTolerateByzantine(5, 2), false);
    // 3f + 1 = 7 nodes: SUCCEEDS
    assert.equal(canTolerateByzantine(7, 2), true);
  });

  await t.test('PBFT reaches Prepared state on 2f prepares and Committed on 2f + 1 commits', () => {
    // N = 4 nodes, f = 1
    const node = new PbftNode(1, 4);

    const digest = 'sha256_hash_of_transaction_payload';
    assert.equal(node.handlePrePrepare(0, 1, digest), true);

    // Prepare phase: node needs 2f = 2 prepares (e.g. from node 1 and node 2)
    node.handlePrepare(1, digest, digest);
    assert.equal(node.prepared, false); // only 1 prepare received

    node.handlePrepare(2, digest, digest);
    assert.equal(node.prepared, true); // 2 prepares received -> PREPARED!

    // Commit phase: node needs 2f + 1 = 3 commits
    node.handleCommit(0, digest, digest);
    node.handleCommit(1, digest, digest);
    assert.equal(node.committed, false); // 2 commits received

    node.handleCommit(2, digest, digest);
    assert.equal(node.committed, true); // 3 commits received -> COMMITTED!
  });
});
