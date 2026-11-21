import { createHash } from 'node:crypto';

/**
 * Executable models for Module 24: Digital Wallet (ByteByteGo Ch. 27).
 * Covers:
 *  1. Fixed-point monetary string -> BigInt minor-unit conversion (vs IEEE-754 float precision drift)
 *     and 1M Transfer TPS -> 2M Account-Leg TPS cluster node-count sizing
 *  2. Distributed Transactions via Try-Confirm/Cancel (TC/C):
 *     - Deduct-first Try (`A: -$amount, C: NOP`) vs broken credit-first Try double-spend hazard
 *     - Persistent Phase Status Table recovery + SHA-256 payload mismatch defense (`409 Conflict`)
 *     - Out-of-Order Execution (`Cancel` arriving before delayed `Try` -> persistent `outOfOrderFlag`
 *       tombstone rejecting late `Try`) and guard against `Cancel` after `Confirm`
 *  3. Deterministic Event Sourcing + CQRS + Snapshots:
 *     - Command vs immutable Event log vs State vs Deterministic State Machine
 *     - Full genesis replay, historical point-in-time balance audit (`getBalanceAtSeq`),
 *       and binary Snapshot + tail-event recovery
 *  4. Multi-Raft Sharded Event-Sourced Wallet Cluster where ONLY the Raft Leader validates
 *     Commands and replicates immutable Events to Followers (`RPO = 0`, zero phantom escrow accounts,
 *     and strict global conservation `sum(allBalances) === initialSupply`)
 *  5. Push-Based Reverse Proxy CQRS vs Pull-Based Client Polling amplification
 */

const MAX_INT64_MINOR_UNITS = (1n << 63n) - 1n;

/**
 * Parses an exact decimal currency string (e.g. `"19.99"`) into 64-bit bounded integer minor units
 * (`1999n` cents) without ever touching IEEE-754 floating-point representation.
 */
export function parseExactDecimalToMinorUnits(amountStr: string, decimals = 2): bigint {
  const trimmed = amountStr.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new SyntaxError(`Invalid monetary decimal string: "${amountStr}"`);
  }
  const [wholePart = '0', fracPart = ''] = trimmed.split('.');
  if (fracPart.length > decimals) {
    throw new RangeError(
      `Fractional precision (${fracPart.length}) exceeds currency decimals (${decimals})`,
    );
  }
  const paddedFrac = fracPart.padEnd(decimals, '0');
  const value = BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFrac || '0');
  if (value > MAX_INT64_MINOR_UNITS) {
    throw new RangeError(`Minor units (${value}) exceed signed 64-bit integer ceiling`);
  }
  return value;
}

function computeTransferPayloadSha256(
  fromAccount: string,
  toAccount: string,
  amountMinorUnits: bigint,
): string {
  return createHash('sha256')
    .update(`${fromAccount}|${toAccount}|${amountMinorUnits.toString()}`)
    .digest('hex');
}

interface TccPhaseStatusRecord {
  readonly transactionId: string;
  readonly fromAccount: string;
  readonly toAccount: string;
  readonly amountMinorUnits: bigint;
  readonly payloadSha256: string;
  tryStatus: 'NOT_SENT' | 'SUCCEEDED' | 'FAILED';
  secondPhase: 'NONE' | 'CONFIRM' | 'CANCEL';
  secondPhaseStatus: 'NOT_SENT' | 'COMPLETED';
  outOfOrderFlag: boolean;
}

/**
 * Models a Try-Confirm/Cancel (TC/C) Distributed Transaction Coordinator across sharded
 * account databases with a persistent Phase Status Table, SHA-256 payload binding, and
 * Out-of-Order Cancel tombstone defense.
 */
export class TccTransferCoordinator {
  private readonly balances = new Map<string, bigint>();
  readonly phaseStatusTable = new Map<string, TccPhaseStatusRecord>();

  seedAccount(accountId: string, initialMinorUnits: bigint): void {
    this.balances.set(accountId, initialMinorUnits);
  }

  getBalance(accountId: string): bigint {
    return this.balances.get(accountId) ?? 0n;
  }

  /**
   * Phase 1 (Try):
   *  - Enforces `(transactionId, payloadSha256)` idempotency binding (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
   *  - Checks `outOfOrderFlag` first: if `cancelPhase` already arrived before `tryPhase`,
   *    rejects immediately so a delayed network packet never locks or debits funds!
   *  - Executes a local transaction deducting `amountMinorUnits` from `fromAccount`
   *    (`NOP` on `toAccount`).
   */
  tryPhase(options: {
    transactionId: string;
    fromAccount: string;
    toAccount: string;
    amountMinorUnits: bigint;
    unsafeCreditReceiverFirstBug?: boolean;
  }): { ok: boolean; reason?: string } {
    if (options.amountMinorUnits <= 0n) {
      return { ok: false, reason: 'INVALID_AMOUNT' };
    }
    const payloadSha256 = computeTransferPayloadSha256(
      options.fromAccount,
      options.toAccount,
      options.amountMinorUnits,
    );

    let record = this.phaseStatusTable.get(options.transactionId);
    if (record) {
      if (record.payloadSha256 !== payloadSha256) {
        return { ok: false, reason: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };
      }
      if (record.outOfOrderFlag || record.secondPhase === 'CANCEL') {
        return { ok: false, reason: 'OUT_OF_ORDER_CANCEL_TOMBSTONE' };
      }
      if (record.tryStatus === 'SUCCEEDED') {
        return { ok: true }; // Idempotent retry
      }
      if (record.tryStatus === 'FAILED') {
        return { ok: false, reason: 'TRY_ALREADY_FAILED' };
      }
    } else {
      record = {
        transactionId: options.transactionId,
        fromAccount: options.fromAccount,
        toAccount: options.toAccount,
        amountMinorUnits: options.amountMinorUnits,
        payloadSha256,
        tryStatus: 'NOT_SENT',
        secondPhase: 'NONE',
        secondPhaseStatus: 'NOT_SENT',
        outOfOrderFlag: false,
      };
      this.phaseStatusTable.set(options.transactionId, record);
    }

    if (options.unsafeCreditReceiverFirstBug) {
      // BROKEN Choice 2 from ByteByteGo Table: crediting C (+amount) in Try before debiting A
      // allows C to spend unbacked phantom money during the in-flight window!
      const receiverBal = this.getBalance(options.toAccount);
      this.balances.set(options.toAccount, receiverBal + options.amountMinorUnits);
      record.tryStatus = 'SUCCEEDED';
      return { ok: true };
    }

    const senderBal = this.getBalance(options.fromAccount);
    if (senderBal < options.amountMinorUnits) {
      record.tryStatus = 'FAILED';
      return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
    }

    // Choice 1 (Correct): deduct from Account A (-amount) in local ACID TX; NOP on Account C
    this.balances.set(options.fromAccount, senderBal - options.amountMinorUnits);
    record.tryStatus = 'SUCCEEDED';
    return { ok: true };
  }

  /**
   * Phase 2a (Confirm):
   *  - Local transaction on `toAccount` shard crediting `+amountMinorUnits` (`NOP` on `fromAccount`).
   */
  confirmPhase(transactionId: string): { ok: boolean; reason?: string } {
    const record = this.phaseStatusTable.get(transactionId);
    if (!record) {
      return { ok: false, reason: 'TRY_NOT_FOUND' };
    }
    if (record.tryStatus !== 'SUCCEEDED') {
      return { ok: false, reason: 'TRY_NOT_SUCCEEDED' };
    }
    if (record.secondPhase === 'CONFIRM' && record.secondPhaseStatus === 'COMPLETED') {
      return { ok: true }; // Idempotent confirm
    }
    if (record.secondPhase === 'CANCEL') {
      return { ok: false, reason: 'ALREADY_CANCELLED' };
    }

    const receiverBal = this.getBalance(record.toAccount);
    this.balances.set(record.toAccount, receiverBal + record.amountMinorUnits);
    record.secondPhase = 'CONFIRM';
    record.secondPhaseStatus = 'COMPLETED';
    return { ok: true };
  }

  /**
   * Phase 2b (Cancel):
   *  - Rejects `Cancel` if `secondPhase === 'CONFIRM'` (`ALREADY_CONFIRMED`), preventing
   *    a late cancel after commit from refunding sender A and minting duplicate money!
   *  - If `Try` has not arrived yet (`NOT_SENT`), writes a persistent `outOfOrderFlag = true`
   *    tombstone (Empty Cancel) so any delayed `Try` packet arriving later is rejected.
   *  - If `Try` succeeded, executes a compensating local transaction refunding `+amountMinorUnits`
   *    back to `fromAccount` (`NOP` on `toAccount`).
   */
  cancelPhase(options: {
    transactionId: string;
    fromAccount: string;
    toAccount: string;
    amountMinorUnits: bigint;
  }): { ok: boolean; outOfOrderTombstoned: boolean; reason?: string } {
    const payloadSha256 = computeTransferPayloadSha256(
      options.fromAccount,
      options.toAccount,
      options.amountMinorUnits,
    );
    let record = this.phaseStatusTable.get(options.transactionId);
    if (!record) {
      // Out-of-order Cancel arrived BEFORE Try! Persist tombstone with outOfOrderFlag = true
      record = {
        transactionId: options.transactionId,
        fromAccount: options.fromAccount,
        toAccount: options.toAccount,
        amountMinorUnits: options.amountMinorUnits,
        payloadSha256,
        tryStatus: 'NOT_SENT',
        secondPhase: 'CANCEL',
        secondPhaseStatus: 'COMPLETED',
        outOfOrderFlag: true,
      };
      this.phaseStatusTable.set(options.transactionId, record);
      return { ok: true, outOfOrderTombstoned: true };
    }

    if (record.payloadSha256 !== payloadSha256) {
      return { ok: false, outOfOrderTombstoned: false, reason: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };
    }
    if (record.secondPhase === 'CONFIRM') {
      return { ok: false, outOfOrderTombstoned: false, reason: 'ALREADY_CONFIRMED' };
    }
    if (record.secondPhase === 'CANCEL' && record.secondPhaseStatus === 'COMPLETED') {
      return { ok: true, outOfOrderTombstoned: record.outOfOrderFlag };
    }

    if (record.tryStatus === 'SUCCEEDED') {
      const senderBal = this.getBalance(record.fromAccount);
      this.balances.set(record.fromAccount, senderBal + record.amountMinorUnits);
    } else if (record.tryStatus === 'NOT_SENT') {
      record.outOfOrderFlag = true;
    }

    record.secondPhase = 'CANCEL';
    record.secondPhaseStatus = 'COMPLETED';
    return { ok: true, outOfOrderTombstoned: record.outOfOrderFlag };
  }
}

interface WalletEvent {
  readonly seq: number;
  readonly transactionId: string;
  readonly payloadSha256: string;
  readonly accountId: string;
  readonly deltaMinorUnits: bigint;
}

interface WalletSnapshot {
  readonly lastAppliedSeq: number;
  readonly balances: ReadonlyMap<string, bigint>;
  readonly appliedTxHashes: ReadonlyMap<string, string>;
}

/**
 * Deterministic Event-Sourced Wallet State Machine (modeling local `mmap` Event Log +
 * local RocksDB LSM state projection + periodic immutable binary Snapshots).
 */
export class EventSourcedWalletMachine {
  private readonly eventLog: WalletEvent[] = [];
  private readonly state = new Map<string, bigint>();
  private readonly appliedTxHashes = new Map<string, string>();

  seedAccount(accountId: string, amountMinorUnits: bigint): WalletEvent {
    if (amountMinorUnits < 0n) throw new RangeError('Initial seed cannot be negative');
    const txId = `\0seed:${accountId}:${this.eventLog.length + 1}`;
    const hash = computeTransferPayloadSha256('__genesis__', accountId, amountMinorUnits);
    const ev = this.appendAndApplyEvent(txId, hash, accountId, amountMinorUnits);
    this.appliedTxHashes.set(txId, hash);
    return ev;
  }

  /**
   * Deterministic State Machine transition on the Raft Leader: validates a transfer Command
   * against current RocksDB/in-memory state and emits two immutable Events (`A - amount`, `C + amount`).
   */
  processTransferCommand(cmd: {
    transactionId: string;
    fromAccount: string;
    toAccount: string;
    amountMinorUnits: bigint;
  }): { ok: boolean; eventsEmitted: number; events: readonly WalletEvent[]; reason?: string } {
    const payloadSha256 = computeTransferPayloadSha256(
      cmd.fromAccount,
      cmd.toAccount,
      cmd.amountMinorUnits,
    );
    const existingHash = this.appliedTxHashes.get(cmd.transactionId);
    if (existingHash !== undefined) {
      if (existingHash !== payloadSha256) {
        return {
          ok: false,
          eventsEmitted: 0,
          events: [],
          reason: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        };
      }
      return { ok: true, eventsEmitted: 0, events: [] }; // Idempotent replay
    }
    if (cmd.amountMinorUnits <= 0n || cmd.fromAccount === cmd.toAccount) {
      return { ok: false, eventsEmitted: 0, events: [], reason: 'INVALID_COMMAND' };
    }
    const senderBal = this.getBalance(cmd.fromAccount);
    if (senderBal < cmd.amountMinorUnits) {
      return { ok: false, eventsEmitted: 0, events: [], reason: 'INSUFFICIENT_FUNDS' };
    }

    const ev1 = this.appendAndApplyEvent(
      cmd.transactionId,
      payloadSha256,
      cmd.fromAccount,
      -cmd.amountMinorUnits,
    );
    const ev2 = this.appendAndApplyEvent(
      cmd.transactionId,
      payloadSha256,
      cmd.toAccount,
      cmd.amountMinorUnits,
    );
    this.appliedTxHashes.set(cmd.transactionId, payloadSha256);
    return { ok: true, eventsEmitted: 2, events: [ev1, ev2] };
  }

  /**
   * Single-leg deterministic command validation on a shard Raft Leader during a cross-shard
   * TC/C or Saga transfer (`deltaMinorUnits < 0n` debits sender; `deltaMinorUnits > 0n` credits receiver).
   */
  processShardLegCommand(cmd: {
    legTransactionId: string;
    payloadSha256: string;
    accountId: string;
    deltaMinorUnits: bigint;
  }): { ok: boolean; event?: WalletEvent; reason?: string } {
    const existingHash = this.appliedTxHashes.get(cmd.legTransactionId);
    if (existingHash !== undefined) {
      if (existingHash !== cmd.payloadSha256) {
        return { ok: false, reason: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };
      }
      return { ok: true };
    }
    if (cmd.deltaMinorUnits === 0n) {
      return { ok: false, reason: 'ZERO_DELTA' };
    }
    const currentBal = this.getBalance(cmd.accountId);
    if (cmd.deltaMinorUnits < 0n && currentBal + cmd.deltaMinorUnits < 0n) {
      return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
    }
    const ev = this.appendAndApplyEvent(
      cmd.legTransactionId,
      cmd.payloadSha256,
      cmd.accountId,
      cmd.deltaMinorUnits,
    );
    this.appliedTxHashes.set(cmd.legTransactionId, cmd.payloadSha256);
    return { ok: true, event: ev };
  }

  /**
   * Raft Follower replication path: Followers NEVER validate raw Commands independently;
   * they apply only the immutable `WalletEvent` entries replicated from the Raft Leader.
   */
  applyReplicatedEvents(events: readonly WalletEvent[]): void {
    for (const ev of events) {
      if (ev.seq <= this.eventLog.length) continue;
      this.eventLog.push(ev);
      this.state.set(ev.accountId, this.getBalance(ev.accountId) + ev.deltaMinorUnits);
      this.appliedTxHashes.set(ev.transactionId, ev.payloadSha256);
    }
  }

  private appendAndApplyEvent(
    transactionId: string,
    payloadSha256: string,
    accountId: string,
    deltaMinorUnits: bigint,
  ): WalletEvent {
    const ev: WalletEvent = {
      seq: this.eventLog.length + 1,
      transactionId,
      payloadSha256,
      accountId,
      deltaMinorUnits,
    };
    this.eventLog.push(ev);
    this.state.set(accountId, this.getBalance(accountId) + deltaMinorUnits);
    return ev;
  }

  getBalance(accountId: string): bigint {
    return this.state.get(accountId) ?? 0n;
  }

  getAllBalances(): ReadonlyMap<string, bigint> {
    return new Map(this.state);
  }

  getEvents(): readonly WalletEvent[] {
    return this.eventLog;
  }

  /**
   * Reconstructs any account's exact balance at historical event sequence `upToSeq`
   * by replaying the immutable Event log from genesis up to `upToSeq`.
   */
  getBalanceAtSeq(accountId: string, upToSeq: number): bigint {
    let bal = 0n;
    for (const ev of this.eventLog) {
      if (ev.seq > upToSeq) break;
      if (ev.accountId === accountId) {
        bal += ev.deltaMinorUnits;
      }
    }
    return bal;
  }

  takeSnapshot(): WalletSnapshot {
    return {
      lastAppliedSeq: this.eventLog.length,
      balances: new Map(this.state),
      appliedTxHashes: new Map(this.appliedTxHashes),
    };
  }

  static restoreFromSnapshotAndTail(
    snapshot: WalletSnapshot,
    fullEventLog: readonly WalletEvent[],
  ): Map<string, bigint> {
    const restored = new Map<string, bigint>(snapshot.balances);
    for (const ev of fullEventLog) {
      if (ev.seq <= snapshot.lastAppliedSeq) continue;
      restored.set(ev.accountId, (restored.get(ev.accountId) ?? 0n) + ev.deltaMinorUnits);
    }
    return restored;
  }
}

function hashAccountToShard(accountId: string, shardCount: number): number {
  let h = 2166136261;
  for (let i = 0; i < accountId.length; i++) {
    h ^= accountId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % shardCount;
}

interface RaftPartitionNode {
  nodeId: string;
  isAlive: boolean;
  readonly machine: EventSourcedWalletMachine;
}

/**
 * Multi-Raft Sharded Event-Sourced Wallet Cluster:
 *  - Partitions accounts across `shardCount` independent Raft consensus groups (`RF = 3`).
 *  - Validates Commands ONLY on each shard's Raft Leader and replicates ONLY the emitted
 *    immutable `WalletEvent` entries to alive Followers (`quorum >= 2`).
 *  - Executes cross-shard transfers via deduct-first Saga/TC/C orchestration and survives
 *    Raft leader failovers with zero data loss (`RPO = 0`) and zero phantom escrow leakage.
 */
export class ShardedRaftWalletCluster {
  readonly shardCount: number;
  private readonly raftGroups: Array<{
    leaderIdx: number;
    nodes: [RaftPartitionNode, RaftPartitionNode, RaftPartitionNode];
  }> = [];
  private readonly completedTransfers = new Map<string, { ok: boolean; payloadSha256: string }>();

  constructor(shardCount: number) {
    if (shardCount < 1) throw new RangeError('shardCount must be >= 1');
    this.shardCount = shardCount;
    for (let s = 0; s < shardCount; s++) {
      this.raftGroups.push({
        leaderIdx: 0,
        nodes: [
          { nodeId: `s${s}-n0`, isAlive: true, machine: new EventSourcedWalletMachine() },
          { nodeId: `s${s}-n1`, isAlive: true, machine: new EventSourcedWalletMachine() },
          { nodeId: `s${s}-n2`, isAlive: true, machine: new EventSourcedWalletMachine() },
        ],
      });
    }
  }

  private getLeaderAndFollowers(shardIdx: number): {
    leader: RaftPartitionNode;
    followers: RaftPartitionNode[];
  } {
    const group = this.raftGroups[shardIdx]!;
    const leader = group.nodes[group.leaderIdx]!;
    if (!leader.isAlive) {
      throw new Error(`Shard ${shardIdx} leader is down and failover has not completed`);
    }
    const alive = group.nodes.filter((n) => n.isAlive);
    if (alive.length < 2) {
      throw new Error(`Shard ${shardIdx} lost Raft majority quorum (${alive.length}/3 alive)`);
    }
    const followers = alive.filter((n) => n.nodeId !== leader.nodeId);
    return { leader, followers };
  }

  seedAccount(accountId: string, amountMinorUnits: bigint): void {
    const shardIdx = hashAccountToShard(accountId, this.shardCount);
    const { leader, followers } = this.getLeaderAndFollowers(shardIdx);
    const seedEvent = leader.machine.seedAccount(accountId, amountMinorUnits);
    for (const follower of followers) {
      follower.machine.applyReplicatedEvents([seedEvent]);
    }
  }

  failoverLeader(shardIdx: number): string {
    const group = this.raftGroups[shardIdx]!;
    group.nodes[group.leaderIdx]!.isAlive = false;
    const nextIdx = group.nodes.findIndex((n) => n.isAlive);
    if (nextIdx === -1) throw new Error(`No alive followers in shard ${shardIdx}`);
    group.leaderIdx = nextIdx;
    return group.nodes[nextIdx]!.nodeId;
  }

  getBalance(accountId: string): bigint {
    const shardIdx = hashAccountToShard(accountId, this.shardCount);
    const group = this.raftGroups[shardIdx]!;
    return group.nodes[group.leaderIdx]!.machine.getBalance(accountId);
  }

  /**
   * Computes the exact sum of ALL account balances across every Raft shard leader in the cluster
   * (plus verifying the provided `accountIds`), ensuring zero hidden escrow or phantom accounts exist.
   */
  getTotalClusterSupply(accountIds?: readonly string[]): bigint {
    let totalAcrossAllShards = 0n;
    for (let s = 0; s < this.shardCount; s++) {
      const group = this.raftGroups[s]!;
      const leaderBalances = group.nodes[group.leaderIdx]!.machine.getAllBalances();
      for (const bal of leaderBalances.values()) {
        totalAcrossAllShards += bal;
      }
    }
    if (accountIds) {
      let requestedSum = 0n;
      for (const id of accountIds) {
        requestedSum += this.getBalance(id);
      }
      if (requestedSum !== totalAcrossAllShards) {
        throw new Error(
          `Global conservation leak: account sum (${requestedSum}) !== total shard state sum (${totalAcrossAllShards})`,
        );
      }
    }
    return totalAcrossAllShards;
  }

  executeTransfer(cmd: {
    transactionId: string;
    fromAccount: string;
    toAccount: string;
    amountMinorUnits: bigint;
  }): boolean {
    const payloadSha256 = computeTransferPayloadSha256(
      cmd.fromAccount,
      cmd.toAccount,
      cmd.amountMinorUnits,
    );
    const prev = this.completedTransfers.get(cmd.transactionId);
    if (prev !== undefined) {
      if (prev.payloadSha256 !== payloadSha256) {
        return false; // Reject payload mismatch on duplicate transactionId
      }
      return prev.ok;
    }

    if (cmd.amountMinorUnits <= 0n || cmd.fromAccount === cmd.toAccount) {
      this.completedTransfers.set(cmd.transactionId, { ok: false, payloadSha256 });
      return false;
    }

    const fromShard = hashAccountToShard(cmd.fromAccount, this.shardCount);
    const toShard = hashAccountToShard(cmd.toAccount, this.shardCount);

    if (fromShard === toShard) {
      const { leader, followers } = this.getLeaderAndFollowers(fromShard);
      const res = leader.machine.processTransferCommand(cmd);
      if (res.ok && res.events.length > 0) {
        for (const follower of followers) {
          follower.machine.applyReplicatedEvents(res.events);
        }
      }
      this.completedTransfers.set(cmd.transactionId, { ok: res.ok, payloadSha256 });
      return res.ok;
    }

    // Cross-shard transfer across two distinct Raft groups:
    // Leg 1 (Try / Debit on fromShard): Leader validates balance[A] >= amount & replicates Debit Event
    const fromGroup = this.getLeaderAndFollowers(fromShard);
    const toGroup = this.getLeaderAndFollowers(toShard);

    const leg1 = fromGroup.leader.machine.processShardLegCommand({
      legTransactionId: `${cmd.transactionId}:leg1`,
      payloadSha256,
      accountId: cmd.fromAccount,
      deltaMinorUnits: -cmd.amountMinorUnits,
    });
    if (!leg1.ok || !leg1.event) {
      this.completedTransfers.set(cmd.transactionId, { ok: false, payloadSha256 });
      return false;
    }
    for (const follower of fromGroup.followers) {
      follower.machine.applyReplicatedEvents([leg1.event]);
    }

    // Leg 2 (Confirm / Credit on toShard): Leader emits Credit Event & replicates to toShard followers
    const leg2 = toGroup.leader.machine.processShardLegCommand({
      legTransactionId: `${cmd.transactionId}:leg2`,
      payloadSha256,
      accountId: cmd.toAccount,
      deltaMinorUnits: cmd.amountMinorUnits,
    });
    if (leg2.ok && leg2.event) {
      for (const follower of toGroup.followers) {
        follower.machine.applyReplicatedEvents([leg2.event]);
      }
    }

    this.completedTransfers.set(cmd.transactionId, { ok: true, payloadSha256 });
    return true;
  }
}

/**
 * Compares Push-Based Reverse Proxy CQRS (where the read-only state machine pushes
 * completion directly back to the reverse proxy) against Pull-Based Client Polling.
 */
export function compareCqrsPushVsPolling(options: {
  transferTps: number;
  eventCommitLatencyMs: number;
  clientPollIntervalMs: number;
}): {
  pushRpcPerTransfer: number;
  pollRpcPerTransfer: number;
  totalPollingQps: number;
  pushCompletionLatencyMs: number;
  pollCompletionLatencyMs: number;
} {
  const pushRpcPerTransfer = 1;
  const pollRpcPerTransfer = Math.ceil(options.eventCommitLatencyMs / options.clientPollIntervalMs);
  const totalPollingQps = options.transferTps * pollRpcPerTransfer;
  const pushCompletionLatencyMs = options.eventCommitLatencyMs;
  const pollCompletionLatencyMs = pollRpcPerTransfer * options.clientPollIntervalMs;

  return {
    pushRpcPerTransfer,
    pollRpcPerTransfer,
    totalPollingQps,
    pushCompletionLatencyMs,
    pollCompletionLatencyMs,
  };
}

/**
 * Computes required database/partition node count for `transferTps` (where each transfer
 * has `legsPerTransfer = 2` account mutations) across single-node TPS tiers.
 */
export function estimateWalletClusterSizing(options: {
  transferTps: number;
  legsPerTransfer?: number;
  perNodeLegTpsTiers: readonly number[];
}): {
  totalLegTps: number;
  nodesByTier: Array<{ perNodeLegTps: number; requiredNodes: number }>;
} {
  const legs = options.legsPerTransfer ?? 2;
  const totalLegTps = options.transferTps * legs;
  const nodesByTier = options.perNodeLegTpsTiers.map((perNodeLegTps) => ({
    perNodeLegTps,
    requiredNodes: Math.ceil(totalLegTps / perNodeLegTps),
  }));
  return { totalLegTps, nodesByTier };
}
