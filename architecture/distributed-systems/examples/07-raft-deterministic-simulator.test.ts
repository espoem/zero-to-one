import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Log entry in Raft.
 */
export interface RaftLogEntry {
  term: number;
  index: number;
  cmd: string;
}

/**
 * Raft Server implementation.
 */
export class RaftServer {
  readonly id: number;
  currentTerm = 0;
  votedFor: number | null = null;
  log: RaftLogEntry[] = [{ term: 0, index: 0, cmd: '__INIT__' }];
  commitIndex = 0;
  lastApplied = 0;

  state: 'FOLLOWER' | 'CANDIDATE' | 'LEADER' = 'FOLLOWER';
  votesReceived = new Set<number>();

  constructor(id: number) {
    this.id = id;
  }

  get lastLog(): RaftLogEntry {
    return this.log[this.log.length - 1]!;
  }

  // --- Election Logic ---
  startElection(): { term: number; lastLogIndex: number; lastLogTerm: number } {
    this.state = 'CANDIDATE';
    this.currentTerm++;
    this.votedFor = this.id;
    this.votesReceived.clear();
    this.votesReceived.add(this.id);

    return {
      term: this.currentTerm,
      lastLogIndex: this.lastLog.index,
      lastLogTerm: this.lastLog.term,
    };
  }

  handleRequestVote(
    candidateId: number,
    candidateTerm: number,
    candidateLastIndex: number,
    candidateLastTerm: number
  ): boolean {
    if (candidateTerm > this.currentTerm) {
      this.currentTerm = candidateTerm;
      this.state = 'FOLLOWER';
      this.votedFor = null;
    }

    if (candidateTerm < this.currentTerm) {
      return false;
    }

    // Voting restriction check: candidate log must be >= receiver log
    const myLast = this.lastLog;
    const isUpToDate =
      candidateLastTerm > myLast.term ||
      (candidateLastTerm === myLast.term && candidateLastIndex >= myLast.index);

    if ((this.votedFor === null || this.votedFor === candidateId) && isUpToDate) {
      this.votedFor = candidateId;
      return true;
    }

    return false;
  }

  recordVote(voterId: number, granted: boolean, clusterSize: number): boolean {
    if (this.state !== 'CANDIDATE') return false;
    if (granted) {
      this.votesReceived.add(voterId);
      const majority = Math.floor(clusterSize / 2) + 1;
      if (this.votesReceived.size >= majority) {
        this.state = 'LEADER';
        return true; // Leader elected!
      }
    }
    return false;
  }

  // --- Replication Logic ---
  replicateCommand(cmd: string): RaftLogEntry {
    if (this.state !== 'LEADER') throw new Error('Not leader');
    const newEntry: RaftLogEntry = {
      term: this.currentTerm,
      index: this.lastLog.index + 1,
      cmd,
    };
    this.log.push(newEntry);
    return newEntry;
  }

  handleAppendEntries(
    term: number,
    prevLogIndex: number,
    prevLogTerm: number,
    entries: RaftLogEntry[],
    leaderCommit: number
  ): boolean {
    if (term > this.currentTerm) {
      this.currentTerm = term;
      this.state = 'FOLLOWER';
      this.votedFor = null;
    }

    if (term < this.currentTerm) {
      return false;
    }

    // Check if receiver has matching entry at prevLogIndex
    if (this.log.length <= prevLogIndex || this.log[prevLogIndex]!.term !== prevLogTerm) {
      return false;
    }

    // Append entries and truncate conflicting suffix
    let insertIdx = prevLogIndex + 1;
    for (const entry of entries) {
      if (insertIdx < this.log.length) {
        if (this.log[insertIdx]!.term !== entry.term) {
          this.log = this.log.slice(0, insertIdx);
          this.log.push(entry);
        }
      } else {
        this.log.push(entry);
      }
      insertIdx++;
    }

    if (leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(leaderCommit, this.lastLog.index);
    }
    return true;
  }
}

test('Module 07: Raft Consensus Invariants & Safety Verification', async (t) => {
  await t.test('Election Safety: At most one leader can be elected in a given term', () => {
    // 3 nodes (0, 1, 2). Majority is 2.
    const cluster = [new RaftServer(0), new RaftServer(1), new RaftServer(2)];

    // Node 0 starts election for term 1
    const req = cluster[0]!.startElection();
    assert.equal(cluster[0]!.state, 'CANDIDATE');

    // Node 1 grants vote to Node 0
    const v1 = cluster[1]!.handleRequestVote(0, req.term, req.lastLogIndex, req.lastLogTerm);
    assert.equal(v1, true);
    const won = cluster[0]!.recordVote(1, v1, cluster.length);
    assert.equal(won, true);
    assert.equal(cluster[0]!.state, 'LEADER');

    // Concurrently, Node 2 attempts to start election in same term 1
    // (Simulating split vote attempt without incrementing term)
    const v0For2 = cluster[0]!.handleRequestVote(2, 1, 0, 0);
    const v1For2 = cluster[1]!.handleRequestVote(2, 1, 0, 0);
    // Both Node 0 and Node 1 already voted for Node 0, so both MUST reject Node 2!
    assert.equal(v0For2, false);
    assert.equal(v1For2, false);

    // Assert Election Safety invariant: exactly 1 leader in term 1
    const leaders = cluster.filter((s) => s.state === 'LEADER' && s.currentTerm === 1);
    assert.equal(leaders.length, 1);
  });

  await t.test('Log Matching Invariant: Followers truncate uncommitted conflicts upon leader sync', () => {
    const leader = new RaftServer(0);
    const follower = new RaftServer(1);

    // Initial identical logs up to index 1, term 1
    leader.currentTerm = 2;
    leader.state = 'LEADER';
    leader.log = [
      { term: 0, index: 0, cmd: '__INIT__' },
      { term: 1, index: 1, cmd: 'set x=1' },
      { term: 2, index: 2, cmd: 'set x=2' },
    ];

    // Follower has uncommitted conflicting entry from an old partitioned term
    follower.currentTerm = 2;
    follower.log = [
      { term: 0, index: 0, cmd: '__INIT__' },
      { term: 1, index: 1, cmd: 'set x=1' },
      { term: 1, index: 2, cmd: 'set x=CONFLICT' },
    ];

    // Leader sends AppendEntries with prevLogIndex=1, prevLogTerm=1, entries=[{term:2, index:2, cmd:'set x=2'}]
    const success = follower.handleAppendEntries(
      leader.currentTerm,
      1,
      1,
      [leader.log[2]!],
      2
    );
    assert.equal(success, true);

    // Conflict resolved: follower log matches leader identically
    assert.equal(follower.log[2]!.cmd, 'set x=2');
    assert.equal(follower.log[2]!.term, 2);
  });

  await t.test('Voting restriction prevents stale nodes from winning elections', () => {
    const s0 = new RaftServer(0);
    const s1 = new RaftServer(1);

    // s0 has a log with term 2, index 5
    s0.log.push({ term: 2, index: 5, cmd: 'cmd5' });
    s0.currentTerm = 2;

    // s1 was partitioned and only has log with term 1, index 2
    s1.log.push({ term: 1, index: 2, cmd: 'cmd2' });
    s1.currentTerm = 3; // Even though s1 has a higher term!

    // s1 requests vote from s0
    const voteGranted = s0.handleRequestVote(1, s1.currentTerm, 2, 1);
    // s0 must REJECT s1 because s1's log is stale (term 1 < term 2)
    assert.equal(voteGranted, false);
  });
});
