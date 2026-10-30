import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Replicated node storing (version, value).
 */
export interface ReplicaCell {
  version: number;
  val: number;
}

/**
 * ABD Register (Attiya, Bar-Noy, Dolev 1995):
 * Implements a linearizable single-writer multi-reader (SWMR) register over quorums
 * by executing Read-Repair during every read.
 */
export class AbdRegister {
  readonly replicas: ReplicaCell[];
  readonly N: number;
  readonly R: number;
  readonly W: number;

  constructor(replicasCount = 3) {
    this.N = replicasCount;
    this.R = Math.floor(replicasCount / 2) + 1; // majority
    this.W = Math.floor(replicasCount / 2) + 1; // majority
    this.replicas = Array.from({ length: replicasCount }, () => ({ version: 0, val: 0 }));
  }

  /**
   * Write Phase:
   * 1. Query read quorum to discover max version.
   * 2. Increment version and write to write quorum.
   */
  write(newVal: number, quorumIndices: number[]): number {
    let maxVer = 0;
    for (const idx of quorumIndices) {
      if (this.replicas[idx]!.version > maxVer) {
        maxVer = this.replicas[idx]!.version;
      }
    }
    const nextVer = maxVer + 1;
    for (const idx of quorumIndices) {
      this.replicas[idx]!.version = nextVer;
      this.replicas[idx]!.val = newVal;
    }
    return nextVer;
  }

  /**
   * Read Phase:
   * 1. Query read quorum to find highest version.
   * 2. CRUCIAL STEP (Read-Repair): Write highest value back to a write quorum before returning!
   */
  readWithRepair(readQuorum: number[], repairQuorum: number[]): number {
    let maxVer = -1;
    let maxVal = 0;

    // Step 1: Read quorum
    for (const idx of readQuorum) {
      if (this.replicas[idx]!.version > maxVer) {
        maxVer = this.replicas[idx]!.version;
        maxVal = this.replicas[idx]!.val;
      }
    }

    // Step 2: Read-Repair write back
    for (const idx of repairQuorum) {
      if (this.replicas[idx]!.version < maxVer) {
        this.replicas[idx]!.version = maxVer;
        this.replicas[idx]!.val = maxVal;
      }
    }

    return maxVal;
  }

  /**
   * Naive read without repair (vulnerable to linearizability violation).
   */
  readNaive(readQuorum: number[]): number {
    let maxVer = -1;
    let maxVal = 0;
    for (const idx of readQuorum) {
      if (this.replicas[idx]!.version > maxVer) {
        maxVer = this.replicas[idx]!.version;
        maxVal = this.replicas[idx]!.val;
      }
    }
    return maxVal;
  }
}

/**
 * Chain Replication implementation.
 */
export class ChainReplication {
  private readonly nodes: number[];

  constructor(chainLength = 3) {
    this.nodes = new Array<number>(chainLength).fill(0);
  }

  write(val: number): boolean {
    // Pipelined: Head -> Middle -> Tail
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i] = val;
    }
    return true; // Tail confirmed
  }

  readTail(): number {
    // Reads served strictly by Tail
    return this.nodes[this.nodes.length - 1]!;
  }
}

test('Module 05: Replication Protocols, Quorums & ABD', async (t) => {
  await t.test('Naive quorum without read-repair demonstrates new-then-old anomaly', () => {
    const reg = new AbdRegister(3); // nodes 0, 1, 2. Majority = 2

    // Writer writes W(1) to node 0 only (interrupted/delayed write)
    reg.replicas[0]!.version = 1;
    reg.replicas[0]!.val = 1;

    // Reader 1 queries quorum {0, 1} -> observes version 1, value 1
    const r1 = reg.readNaive([0, 1]);
    assert.equal(r1, 1);

    // Reader 2 queries quorum {1, 2} AFTER Reader 1 completed -> observes version 0, value 0!
    const r2 = reg.readNaive([1, 2]);
    assert.equal(r2, 0); // VIOLATION: saw old data after new data was observed!
  });

  await t.test('ABD protocol with Read-Repair restores linearizability', () => {
    const reg = new AbdRegister(3);

    // Partial write to node 0
    reg.replicas[0]!.version = 1;
    reg.replicas[0]!.val = 1;

    // Reader 1 queries quorum {0, 1} and executes read-repair back to {1, 2}
    const r1 = reg.readWithRepair([0, 1], [1, 2]);
    assert.equal(r1, 1);

    // Node 1 was repaired during read 1!
    // Reader 2 queries quorum {1, 2} -> now guaranteed to see 1!
    const r2 = reg.readWithRepair([1, 2], [1, 2]);
    assert.equal(r2, 1); // Fixed!
  });

  await t.test('Chain Replication guarantees linearizable reads at tail', () => {
    const chain = new ChainReplication(3);
    assert.equal(chain.readTail(), 0);

    chain.write(42);
    assert.equal(chain.readTail(), 42);
  });
});
