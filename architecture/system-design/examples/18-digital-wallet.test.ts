import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  EventSourcedWalletMachine,
  ShardedRaftWalletCluster,
  TccTransferCoordinator,
  compareCqrsPushVsPolling,
  estimateWalletClusterSizing,
  parseExactDecimalToMinorUnits,
} from './lib/wallet-models.ts';

describe('Module 24: Digital Wallet Executable Proofs', () => {
  it('TccTransferCoordinator executes Try-Confirm, refunds Try-Cancel, rejects Cancel-after-Confirm and payload mismatch, prevents in-flight double-spend, and blocks out-of-order late Try packets via Cancel tombstones', () => {
    const tcc = new TccTransferCoordinator();
    tcc.seedAccount('alice', 100_00n); // $100.00
    tcc.seedAccount('charlie', 50_00n); // $50.00

    // 1. Happy-path Try ($30) -> Confirm ($30)
    const try1 = tcc.tryPhase({
      transactionId: 'tx-1',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 30_00n,
    });
    assert.equal(try1.ok, true);
    // During in-flight Try window: Alice is already debited ($70.00), Charlie is still $50.00 (unbalanced but safe!)
    assert.equal(tcc.getBalance('alice'), 70_00n);
    assert.equal(tcc.getBalance('charlie'), 50_00n);

    // Negative test (Payload Mismatch): retrying tx-1 with different amount/recipient returns IDEMPOTENCY_PAYLOAD_MISMATCH
    const mismatchTry = tcc.tryPhase({
      transactionId: 'tx-1',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 90_00n,
    });
    assert.equal(mismatchTry.ok, false);
    assert.equal(mismatchTry.reason, 'IDEMPOTENCY_PAYLOAD_MISMATCH');

    // Negative test: Alice cannot double-spend the held $30 while tx-1 is in-flight!
    const doubleSpendTry = tcc.tryPhase({
      transactionId: 'tx-double-spend',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 80_00n,
    });
    assert.equal(doubleSpendTry.ok, false);
    assert.equal(doubleSpendTry.reason, 'INSUFFICIENT_FUNDS');

    // Confirm tx-1 -> Charlie receives +$30.00 ($80.00), conservation restored ($70 + $80 = $150)
    assert.equal(tcc.confirmPhase('tx-1').ok, true);
    assert.equal(tcc.getBalance('alice'), 70_00n);
    assert.equal(tcc.getBalance('charlie'), 80_00n);

    // Negative test (Cancel after Confirm): must reject with ALREADY_CONFIRMED and never mint refund money!
    const cancelAfterConfirm = tcc.cancelPhase({
      transactionId: 'tx-1',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 30_00n,
    });
    assert.equal(cancelAfterConfirm.ok, false);
    assert.equal(cancelAfterConfirm.reason, 'ALREADY_CONFIRMED');
    assert.equal(tcc.getBalance('alice') + tcc.getBalance('charlie'), 150_00n);

    // 2. Try ($20) followed by Cancel -> refunds +$20.00 back to Alice ($70.00)
    assert.equal(
      tcc.tryPhase({
        transactionId: 'tx-2-cancel',
        fromAccount: 'alice',
        toAccount: 'charlie',
        amountMinorUnits: 20_00n,
      }).ok,
      true,
    );
    assert.equal(tcc.getBalance('alice'), 50_00n);
    const cancel2 = tcc.cancelPhase({
      transactionId: 'tx-2-cancel',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 20_00n,
    });
    assert.equal(cancel2.ok, true);
    assert.equal(tcc.getBalance('alice'), 70_00n);

    // 3. Negative test (Out-of-Order Execution): Cancel arrives BEFORE delayed Try packet!
    const earlyCancel = tcc.cancelPhase({
      transactionId: 'tx-3-out-of-order',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 25_00n,
    });
    assert.equal(earlyCancel.ok, true);
    assert.equal(earlyCancel.outOfOrderTombstoned, true);

    // Delayed Try packet arrives 200ms after Cancel -> rejected by outOfOrderFlag tombstone!
    const lateTry = tcc.tryPhase({
      transactionId: 'tx-3-out-of-order',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 25_00n,
    });
    assert.equal(lateTry.ok, false);
    assert.equal(lateTry.reason, 'OUT_OF_ORDER_CANCEL_TOMBSTONE');
    assert.equal(tcc.getBalance('alice'), 70_00n);

    // 4. Negative test: Broken Choice 2 (crediting receiver in Try before debiting sender) allows phantom spend
    const brokenTcc = new TccTransferCoordinator();
    brokenTcc.seedAccount('alice', 0n);
    brokenTcc.seedAccount('charlie', 0n);
    brokenTcc.tryPhase({
      transactionId: 'tx-broken-choice2',
      fromAccount: 'alice',
      toAccount: 'charlie',
      amountMinorUnits: 50_00n,
      unsafeCreditReceiverFirstBug: true,
    });
    // Charlie now has $50.00 of phantom unbacked money even though Alice had $0!
    assert.equal(brokenTcc.getBalance('charlie'), 50_00n);
  });

  it('EventSourcedWalletMachine proves deterministic replay, point-in-time historical balance audit, Snapshot + tail recovery, and exact BigInt minor units vs IEEE-754 float drift', () => {
    // Negative test: IEEE-754 float `0.1 + 0.2 !== 0.3`, whereas exact string -> BigInt minor units is exact
    assert.notEqual(0.1 + 0.2, 0.3);
    assert.equal(
      parseExactDecimalToMinorUnits('0.10') + parseExactDecimalToMinorUnits('0.20'),
      parseExactDecimalToMinorUnits('0.30'),
    );

    const machine = new EventSourcedWalletMachine();
    machine.seedAccount('A', parseExactDecimalToMinorUnits('100.00')); // seq 1
    machine.seedAccount('B', parseExactDecimalToMinorUnits('50.00')); // seq 2
    machine.seedAccount('C', parseExactDecimalToMinorUnits('25.00')); // seq 3

    // Transfer 1: A -> B $30.00 (seq 4: A -3000, seq 5: B +3000)
    assert.equal(
      machine.processTransferCommand({
        transactionId: 'es-tx-1',
        fromAccount: 'A',
        toAccount: 'B',
        amountMinorUnits: 30_00n,
      }).ok,
      true,
    );

    // Negative test: reusing es-tx-1 with mutated payload returns IDEMPOTENCY_PAYLOAD_MISMATCH
    assert.equal(
      machine.processTransferCommand({
        transactionId: 'es-tx-1',
        fromAccount: 'A',
        toAccount: 'C',
        amountMinorUnits: 30_00n,
      }).reason,
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
    );

    // Take binary snapshot at seq = 5
    const snapshotAt5 = machine.takeSnapshot();
    assert.equal(snapshotAt5.lastAppliedSeq, 5);

    // Transfer 2: B -> C $40.00 (seq 6: B -4000, seq 7: C +4000)
    assert.equal(
      machine.processTransferCommand({
        transactionId: 'es-tx-2',
        fromAccount: 'B',
        toAccount: 'C',
        amountMinorUnits: 40_00n,
      }).ok,
      true,
    );

    // Audit question 1: "Do we know the account balance at any given historical point in time?"
    assert.equal(machine.getBalanceAtSeq('B', 2), 50_00n);
    assert.equal(machine.getBalanceAtSeq('B', 5), 80_00n);
    assert.equal(machine.getBalanceAtSeq('B', 7), 40_00n);

    // Audit question 2: "Does Snapshot_5 + tail events (seq 6..7) equal current state?"
    const restoredFromSnap = EventSourcedWalletMachine.restoreFromSnapshotAndTail(
      snapshotAt5,
      machine.getEvents(),
    );
    assert.deepEqual(restoredFromSnap, machine.getAllBalances());
  });

  it('ShardedRaftWalletCluster preserves RPO=0 across Raft leader failover and strictly conserves total money supply across arbitrary transfer sequences (fast-check)', () => {
    const cluster = new ShardedRaftWalletCluster(4);
    const accounts = ['acc-1', 'acc-2', 'acc-3', 'acc-4', 'acc-5', 'acc-6'];
    for (const acc of accounts) {
      cluster.seedAccount(acc, 1_000_00n); // $1,000.00 each -> $6,000.00 total supply
    }
    const initialSupply = cluster.getTotalClusterSupply(accounts);
    assert.equal(initialSupply, 6_000_00n);

    // Execute cross-shard transfer and fail over Shard 0's Raft leader
    assert.equal(
      cluster.executeTransfer({
        transactionId: 'raft-tx-1',
        fromAccount: 'acc-1',
        toAccount: 'acc-4',
        amountMinorUnits: 250_00n,
      }),
      true,
    );
    const newLeader = cluster.failoverLeader(0);
    assert.ok(newLeader.endsWith('-n1'));
    assert.equal(cluster.getBalance('acc-1'), 750_00n);
    assert.equal(cluster.getBalance('acc-4'), 1_250_00n);
    assert.equal(cluster.getTotalClusterSupply(accounts), initialSupply);

    // Property test: arbitrary sequence of valid, over-balance, duplicate-retry, and self-transfers
    // NEVER creates or destroys a single cent across all Raft shards
    const transferArb = fc.array(
      fc.record({
        txIdx: fc.integer({ min: 1, max: 15 }), // low cardinality forces idempotent retry collisions
        fromIdx: fc.integer({ min: 0, max: accounts.length - 1 }),
        toIdx: fc.integer({ min: 0, max: accounts.length - 1 }),
        amountCents: fc.bigInt({ min: -50_00n, max: 600_00n }),
      }),
      { minLength: 10, maxLength: 40 },
    );

    fc.assert(
      fc.property(transferArb, (ops) => {
        const sim = new ShardedRaftWalletCluster(4);
        for (const acc of accounts) sim.seedAccount(acc, 500_00n);
        const expectedSupply = 3_000_00n;

        for (const op of ops) {
          sim.executeTransfer({
            transactionId: `prop-tx-${op.txIdx}`,
            fromAccount: accounts[op.fromIdx]!,
            toAccount: accounts[op.toIdx]!,
            amountMinorUnits: op.amountCents,
          });
        }

        assert.equal(sim.getTotalClusterSupply(accounts), expectedSupply);
        for (const acc of accounts) {
          assert.ok(sim.getBalance(acc) >= 0n, `Account ${acc} went negative!`);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('compareCqrsPushVsPolling proves Push-Based Reverse Proxy CQRS eliminates polling QPS amplification and tail latency', () => {
    const cmp = compareCqrsPushVsPolling({
      transferTps: 1_000_000,
      eventCommitLatencyMs: 35,
      clientPollIntervalMs: 10,
    });

    assert.equal(cmp.pushRpcPerTransfer, 1);
    assert.equal(cmp.pollRpcPerTransfer, 4); // 4 polls at 10ms intervals to observe a 35ms commit
    assert.equal(cmp.totalPollingQps, 4_000_000); // 4M polling QPS overloading read state machines!
    assert.ok(cmp.pushCompletionLatencyMs < cmp.pollCompletionLatencyMs);
  });

  it('estimateWalletClusterSizing proves 1M transfer TPS equals 2M account-leg TPS and verifies ByteByteGo node counts across 100 / 1,000 / 10,000 / 100,000 TPS tiers', () => {
    const sizing = estimateWalletClusterSizing({
      transferTps: 1_000_000,
      perNodeLegTpsTiers: [100, 1_000, 10_000, 100_000],
    });

    assert.equal(sizing.totalLegTps, 2_000_000);
    assert.deepEqual(sizing.nodesByTier, [
      { perNodeLegTps: 100, requiredNodes: 20_000 },
      { perNodeLegTps: 1_000, requiredNodes: 2_000 },
      { perNodeLegTps: 10_000, requiredNodes: 200 },
      { perNodeLegTps: 100_000, requiredNodes: 20 },
    ]);
  });
});
