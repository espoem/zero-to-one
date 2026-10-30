import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Paxos Acceptor state.
 */
export interface AcceptorState {
  promisedNum: number;
  acceptedNum: number;
  acceptedVal: string | null;
}

export class PaxosCluster {
  readonly acceptors: AcceptorState[];

  constructor(count = 3) {
    this.acceptors = Array.from({ length: count }, () => ({
      promisedNum: 0,
      acceptedNum: 0,
      acceptedVal: null,
    }));
  }

  // Phase 1: Prepare
  prepare(
    proposalNum: number,
    acceptorIndices: number[]
  ): { ok: boolean; maxVal: string | null; maxNum: number } {
    let promises = 0;
    let maxVal: string | null = null;
    let maxNum = 0;

    for (const idx of acceptorIndices) {
      const a = this.acceptors[idx]!;
      if (proposalNum > a.promisedNum) {
        a.promisedNum = proposalNum;
        promises++;
        if (a.acceptedNum > maxNum) {
          maxNum = a.acceptedNum;
          maxVal = a.acceptedVal;
        }
      }
    }

    const quorum = Math.floor(this.acceptors.length / 2) + 1;
    return { ok: promises >= quorum, maxVal, maxNum };
  }

  // Phase 2: Accept
  accept(proposalNum: number, val: string, acceptorIndices: number[]): boolean {
    let accepted = 0;
    for (const idx of acceptorIndices) {
      const a = this.acceptors[idx]!;
      if (proposalNum >= a.promisedNum) {
        a.promisedNum = proposalNum;
        a.acceptedNum = proposalNum;
        a.acceptedVal = val;
        accepted++;
      }
    }
    const quorum = Math.floor(this.acceptors.length / 2) + 1;
    return accepted >= quorum;
  }
}

/**
 * Flexible Paxos Quorum validator.
 * Checks whether Phase 1 quorum set and Phase 2 quorum set intersect.
 */
export function validateFlexibleQuorums(q1: Set<number>, q2: Set<number>): boolean {
  for (const node of q1) {
    if (q2.has(node)) return true; // Overlap!
  }
  return false;
}

test('Module 06: Consensus Foundations, Paxos & Flexible Paxos', async (t) => {
  await t.test('Single-Decree Paxos reaches consensus on proposed value', () => {
    const cluster = new PaxosCluster(3); // 3 acceptors (0, 1, 2)

    // Proposer 1 (n=1) runs Phase 1 on majority {0, 1}
    const p1 = cluster.prepare(1, [0, 1]);
    assert.equal(p1.ok, true);
    assert.equal(p1.maxVal, null);

    // Proposer 1 runs Phase 2 with value "ValueA"
    const a1 = cluster.accept(1, 'ValueA', [0, 1]);
    assert.equal(a1, true);

    // ValueA is chosen! Now Proposer 2 (n=2) attempts to propose "ValueB" on {1, 2}
    const p2 = cluster.prepare(2, [1, 2]);
    assert.equal(p2.ok, true);
    // Acceptor 1 was in the previous quorum, so it reports "ValueA"!
    assert.equal(p2.maxVal, 'ValueA');

    // Rule: Proposer 2 MUST adopt "ValueA", cannot force "ValueB"
    const chosenVal = p2.maxVal ?? 'ValueB';
    assert.equal(chosenVal, 'ValueA');

    const a2 = cluster.accept(2, chosenVal, [1, 2]);
    assert.equal(a2, true);

    // Verify Agreement holds: no split decision
    assert.equal(cluster.acceptors[0]!.acceptedVal, 'ValueA');
    assert.equal(cluster.acceptors[1]!.acceptedVal, 'ValueA');
    assert.equal(cluster.acceptors[2]!.acceptedVal, 'ValueA');
  });

  await t.test('Flexible Paxos validates asymmetric non-majority quorums', () => {
    // 6-node cluster: N = 6
    // Classic Paxos requires majorities of 4 and 4.
    // Flexible Paxos allows Q1 = 5 nodes, Q2 = 2 nodes!
    const q1 = new Set([0, 1, 2, 3, 4]); // Phase 1 (election) size 5
    const q2 = new Set([4, 5]);          // Phase 2 (write path) size 2

    // Q1 and Q2 intersect at node 4 (5 + 2 = 7 > 6)
    assert.equal(validateFlexibleQuorums(q1, q2), true);

    // Disjoint quorums would fail
    const disjointQ2 = new Set([5]);
    const disjointQ1 = new Set([0, 1, 2]);
    assert.equal(validateFlexibleQuorums(disjointQ1, disjointQ2), false);
  });
});
