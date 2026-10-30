import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface VersionedRow<T> {
  id: string;
  data: T;
  xmin: number; // Created by txn_id
  xmax: number | null; // Deleted/superseded by txn_id
}

export interface Snapshot {
  txnId: number;
  activeTxnIds: Set<number>;
}

export class MVCCTransactionManager<T> {
  private currentTxnId = 1;
  readonly committedTxns = new Set<number>();
  readonly activeTxns = new Set<number>();
  readonly table: VersionedRow<T>[] = [];

  // SSI Dependency Tracking: rw-antidependencies
  readonly inRwEdges = new Map<number, Set<number>>(); // T -> set of T' where T' -rw-> T
  readonly outRwEdges = new Map<number, Set<number>>(); // T -> set of T' where T -rw-> T'

  beginTransaction(): Snapshot {
    const txnId = this.currentTxnId++;
    const snapshot: Snapshot = {
      txnId,
      activeTxnIds: new Set(this.activeTxns),
    };
    this.activeTxns.add(txnId);
    this.inRwEdges.set(txnId, new Set());
    this.outRwEdges.set(txnId, new Set());
    return snapshot;
  }

  commit(txnId: number): void {
    assert(this.activeTxns.has(txnId), 'Transaction not active');
    this.activeTxns.delete(txnId);
    this.committedTxns.add(txnId);
  }

  abort(txnId: number): void {
    assert(this.activeTxns.has(txnId), 'Transaction not active');
    this.activeTxns.delete(txnId);
  }

  insert(snapshot: Snapshot, id: string, data: T): void {
    this.table.push({
      id,
      data,
      xmin: snapshot.txnId,
      xmax: null,
    });
  }

  update(snapshot: Snapshot, id: string, newData: T): void {
    // 1. Find currently visible row
    const visible = this.get(snapshot, id);
    if (!visible) {
      throw new Error(`Row ${id} not found or not visible`);
    }

    // First-committer-wins check
    if (visible.xmax !== null && (this.activeTxns.has(visible.xmax) || this.committedTxns.has(visible.xmax))) {
      throw new Error(`Write-write conflict on row ${id}: already modified by txn ${visible.xmax}`);
    }

    // 2. Mark old version as superseded by this txn
    visible.xmax = snapshot.txnId;

    // 3. Insert new version
    this.table.push({
      id,
      data: newData,
      xmin: snapshot.txnId,
      xmax: null,
    });
  }

  get(snapshot: Snapshot, id: string): VersionedRow<T> | null {
    // Search in reverse for latest visible version
    for (let i = this.table.length - 1; i >= 0; i--) {
      const row = this.table[i]!;
      if (row.id === id && this.isVisible(row, snapshot)) {
        return row;
      }
    }
    return null;
  }

  scan(snapshot: Snapshot, predicate?: (data: T) => boolean): T[] {
    const results: T[] = [];
    const seenIds = new Set<string>();

    for (let i = this.table.length - 1; i >= 0; i--) {
      const row = this.table[i]!;
      if (!seenIds.has(row.id)) {
        if (this.isVisible(row, snapshot)) {
          seenIds.add(row.id);
          if (!predicate || predicate(row.data)) {
            results.push(row.data);
          }
        }
      }
    }
    return results;
  }

  private isVisible(row: VersionedRow<T>, snapshot: Snapshot): boolean {
    const { txnId, activeTxnIds } = snapshot;

    // 1. Was it created by this transaction?
    if (row.xmin === txnId) {
      return row.xmax === null || row.xmax !== txnId;
    }

    // 2. Was it created after our snapshot started?
    if (row.xmin > txnId) return false;

    // 3. Did creating transaction commit before our snapshot?
    const createdCommitted = this.committedTxns.has(row.xmin) && !activeTxnIds.has(row.xmin);
    if (!createdCommitted) return false;

    // 4. Was it deleted?
    if (row.xmax === null) return true;

    // If deleted by this transaction, it is NOT visible
    if (row.xmax === txnId) return false;

    // If deleted by a transaction that started AFTER our snapshot, deletion is NOT visible
    if (row.xmax > txnId) return true;

    // If deleted by a transaction active when our snapshot was taken, deletion is NOT visible
    if (activeTxnIds.has(row.xmax)) return true;

    // If deleted by a transaction committed before our snapshot, NOT visible
    const deletedCommitted = this.committedTxns.has(row.xmax);
    return !deletedCommitted;
  }

  // SSI: Register an rw-antidependency: Reader T1 read a version that Writer T2 overwrote
  recordRwEdge(readerTxnId: number, writerTxnId: number): void {
    if (readerTxnId === writerTxnId) return;

    this.outRwEdges.get(readerTxnId)?.add(writerTxnId);
    this.inRwEdges.get(writerTxnId)?.add(readerTxnId);

    // Check for dangerous structure: T_in -rw-> T_pivot -rw-> T_out
    const inEdges = this.inRwEdges.get(writerTxnId);
    const outEdges = this.outRwEdges.get(writerTxnId);

    if (inEdges && inEdges.size > 0 && outEdges && outEdges.size > 0) {
      throw new Error(
        `SSI Serialization Failure (Dangerous Structure Detected): Txn ${writerTxnId} is a pivot between rw-dependencies! Aborting to prevent Write Skew.`
      );
    }
  }
}

describe('Multi-Version Concurrency Control (MVCC) & Isolation', () => {
  interface Doctor {
    name: string;
    onCall: boolean;
  }

  it('provides consistent snapshot isolation without blocking readers', () => {
    const mvcc = new MVCCTransactionManager<{ balance: number }>();
    const t0 = mvcc.beginTransaction();
    mvcc.insert(t0, 'acc1', { balance: 100 });
    mvcc.commit(t0.txnId);

    // T1 begins
    const t1 = mvcc.beginTransaction();
    assert.equal(mvcc.get(t1, 'acc1')?.data.balance, 100);

    // Concurrent T2 updates acc1 and commits
    const t2 = mvcc.beginTransaction();
    mvcc.update(t2, 'acc1', { balance: 250 });
    mvcc.commit(t2.txnId);

    // T1 continues: observes its original snapshot of 100 (non-repeatable read prevented!)
    assert.equal(mvcc.get(t1, 'acc1')?.data.balance, 100);
    mvcc.commit(t1.txnId);

    // T3 begins after T2 committed: observes 250
    const t3 = mvcc.beginTransaction();
    assert.equal(mvcc.get(t3, 'acc1')?.data.balance, 250);
    mvcc.commit(t3.txnId);
  });

  it('demonstrates the classic Write Skew anomaly under standard Snapshot Isolation', () => {
    const mvcc = new MVCCTransactionManager<Doctor>();
    const t0 = mvcc.beginTransaction();
    mvcc.insert(t0, 'alice', { name: 'Alice', onCall: true });
    mvcc.insert(t0, 'bob', { name: 'Bob', onCall: true });
    mvcc.commit(t0.txnId);

    // Constraint: At least 1 doctor must be on call
    // Concurrent Transaction 1 (Alice requests off-call)
    const t1 = mvcc.beginTransaction();
    const onCallDoctorsT1 = mvcc.scan(t1, (d) => d.onCall);
    assert.equal(onCallDoctorsT1.length, 2); // 2 on call, Alice feels safe to leave

    // Concurrent Transaction 2 (Bob requests off-call)
    const t2 = mvcc.beginTransaction();
    const onCallDoctorsT2 = mvcc.scan(t2, (d) => d.onCall);
    assert.equal(onCallDoctorsT2.length, 2); // 2 on call, Bob feels safe to leave

    // Alice updates her row and commits
    mvcc.update(t1, 'alice', { name: 'Alice', onCall: false });
    mvcc.commit(t1.txnId);

    // Bob updates his row and commits (disjoint write sets: no write conflict!)
    mvcc.update(t2, 'bob', { name: 'Bob', onCall: false });
    mvcc.commit(t2.txnId);

    // Result under Snapshot Isolation: Write Skew occurred! ZERO doctors on call!
    const tAudit = mvcc.beginTransaction();
    const finalOnCall = mvcc.scan(tAudit, (d) => d.onCall);
    assert.equal(finalOnCall.length, 0); // Invariant violated!
    mvcc.commit(tAudit.txnId);
  });

  it('prevents Write Skew using Serializable Snapshot Isolation (SSI) dependency tracking', () => {
    const mvcc = new MVCCTransactionManager<Doctor>();
    const t0 = mvcc.beginTransaction();
    mvcc.insert(t0, 'alice', { name: 'Alice', onCall: true });
    mvcc.insert(t0, 'bob', { name: 'Bob', onCall: true });
    mvcc.commit(t0.txnId);

    const t1 = mvcc.beginTransaction();
    const t2 = mvcc.beginTransaction();

    // T1 reads Bob; T2 modifies Bob -> edge T1 -rw-> T2
    mvcc.recordRwEdge(t1.txnId, t2.txnId);

    // T2 reads Alice; T1 modifies Alice -> edge T2 -rw-> T1
    // Cycle forms: T1 -rw-> T2 -rw-> T1. T1 becomes a pivot!
    assert.throws(
      () => mvcc.recordRwEdge(t2.txnId, t1.txnId),
      /SSI Serialization Failure.*Dangerous Structure Detected/
    );
  });
});
