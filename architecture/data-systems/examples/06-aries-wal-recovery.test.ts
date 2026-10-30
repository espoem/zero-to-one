import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface LogRecord {
  lsn: number;
  prevLsn: number;
  txnId: number;
  type: 'BEGIN' | 'UPDATE' | 'COMMIT' | 'CLR';
  pageId?: number;
  beforeVal?: number;
  afterVal?: number;
  undoNextLsn?: number; // Present on CLR records
}

export class ARIESRecoveryEngine {
  log: LogRecord[] = [];
  currentLsn = 1;
  checkpointLsn: number | null = null;

  // Database pages on disk: pageId -> { value, pageLsn }
  diskPages = new Map<number, { value: number; pageLsn: number }>();

  appendLog(
    txnId: number,
    type: 'BEGIN' | 'UPDATE' | 'COMMIT' | 'CLR',
    prevLsn: number,
    opts?: { pageId?: number; beforeVal?: number; afterVal?: number; undoNextLsn?: number }
  ): LogRecord {
    const lsn = this.currentLsn++;
    const record: LogRecord = {
      lsn,
      prevLsn,
      txnId,
      type,
      ...opts,
    };
    this.log.push(record);
    return record;
  }

  checkpoint(): void {
    this.checkpointLsn = this.currentLsn - 1;
  }

  recover(): { loserTxns: Set<number>; redoneLsns: number[]; undoneLsns: number[] } {
    const startLsn = this.checkpointLsn ?? 1;

    // 1. Analysis Pass
    const activeTxns = new Set<number>();
    const dirtyPageTable = new Map<number, number>(); // pageId -> recLsn
    const txnLastLsn = new Map<number, number>(); // txnId -> lastLsn

    for (let i = startLsn - 1; i < this.log.length; i++) {
      const rec = this.log[i]!;
      txnLastLsn.set(rec.txnId, rec.lsn);

      if (rec.type === 'BEGIN') {
        activeTxns.add(rec.txnId);
      } else if (rec.type === 'COMMIT') {
        activeTxns.delete(rec.txnId);
      } else if (rec.type === 'UPDATE' && rec.pageId !== undefined) {
        if (!dirtyPageTable.has(rec.pageId)) {
          dirtyPageTable.set(rec.pageId, rec.lsn);
        }
      }
    }

    const loserTxns = new Set(activeTxns);
    let minRecLsn = this.log.length > 0 ? this.log[0]!.lsn : 1;
    for (const recLsn of dirtyPageTable.values()) {
      if (recLsn < minRecLsn) minRecLsn = recLsn;
    }

    // 2. Redo Pass (Repeating History)
    const redoneLsns: number[] = [];
    for (let i = minRecLsn - 1; i < this.log.length; i++) {
      const rec = this.log[i]!;
      if (rec.type === 'UPDATE' || rec.type === 'CLR') {
        const page = this.diskPages.get(rec.pageId!) ?? { value: 0, pageLsn: 0 };
        // Idempotency check: skip if page on disk already reflects this log record
        if (page.pageLsn < rec.lsn) {
          page.value = rec.afterVal!;
          page.pageLsn = rec.lsn;
          this.diskPages.set(rec.pageId!, page);
          redoneLsns.push(rec.lsn);
        }
      }
    }

    // 3. Undo Pass (Rolling back loser transactions in reverse)
    const undoneLsns: number[] = [];
    const undoCandidates: number[] = [];
    for (const loser of loserTxns) {
      const lastLsn = txnLastLsn.get(loser);
      if (lastLsn) undoCandidates.push(lastLsn);
    }

    while (undoCandidates.length > 0) {
      // Find the maximum LSN among all active loser transactions
      undoCandidates.sort((a, b) => b - a);
      const lsnToUndo = undoCandidates.shift()!;
      const rec = this.log[lsnToUndo - 1]!;

      if (rec.type === 'UPDATE') {
        // Rollback update: write CLR and revert value
        const clr = this.appendLog(rec.txnId, 'CLR', lsnToUndo, {
          pageId: rec.pageId,
          beforeVal: rec.afterVal,
          afterVal: rec.beforeVal,
          undoNextLsn: rec.prevLsn,
        });

        const page = this.diskPages.get(rec.pageId!)!;
        page.value = rec.beforeVal!;
        page.pageLsn = clr.lsn;
        undoneLsns.push(rec.lsn);

        if (rec.prevLsn > 0) {
          undoCandidates.push(rec.prevLsn);
        }
      } else if (rec.type === 'CLR' && rec.undoNextLsn && rec.undoNextLsn > 0) {
        // Skip already undone actions! Follow undoNextLsn
        undoCandidates.push(rec.undoNextLsn);
      } else if (rec.prevLsn > 0) {
        undoCandidates.push(rec.prevLsn);
      }
    }

    return { loserTxns, redoneLsns, undoneLsns };
  }
}

describe('ARIES Crash Recovery Algorithm', () => {
  it('correctly executes Analysis, Redo, and Undo with CLR logging', () => {
    const aries = new ARIESRecoveryEngine();

    // T1 begins and commits
    const l1 = aries.appendLog(1, 'BEGIN', 0);
    const l2 = aries.appendLog(1, 'UPDATE', l1.lsn, { pageId: 10, beforeVal: 0, afterVal: 100 });
    // Simulate disk page 10 was flushed to disk with LSN l2
    aries.diskPages.set(10, { value: 100, pageLsn: l2.lsn });
    aries.appendLog(1, 'COMMIT', l2.lsn);

    // T2 begins and modifies page 20, but system crashes BEFORE commit! (T2 is a Loser)
    const l4 = aries.appendLog(2, 'BEGIN', 0);
    const l5 = aries.appendLog(2, 'UPDATE', l4.lsn, { pageId: 20, beforeVal: 0, afterVal: 999 });
    // Page 20 was flushed to disk (Steal policy!)
    aries.diskPages.set(20, { value: 999, pageLsn: l5.lsn });

    // CRASH OCCURS HERE!
    const { loserTxns, redoneLsns, undoneLsns } = aries.recover();

    // Analysis correctly identified T2 as loser
    assert.deepEqual(Array.from(loserTxns), [2]);

    // Redo skipped page 10 (already on disk), and Undo rolled back page 20
    assert.equal(undoneLsns.includes(l5.lsn), true);

    // Page 20 successfully reverted to beforeVal (0)
    assert.equal(aries.diskPages.get(20)?.value, 0);
    // Page 10 committed value (100) preserved
    assert.equal(aries.diskPages.get(10)?.value, 100);

    // Verified a CLR was appended to the log
    const lastRec = aries.log[aries.log.length - 1]!;
    assert.equal(lastRec.type, 'CLR');
    assert.equal(lastRec.afterVal, 0);
  });

  it('guarantees crash-during-recovery idempotency via Compensation Log Records (CLRs)', () => {
    const aries = new ARIESRecoveryEngine();

    // T1 modifies page 10 (from 0 to 50), then crashes
    const l1 = aries.appendLog(1, 'BEGIN', 0);
    const l2 = aries.appendLog(1, 'UPDATE', l1.lsn, { pageId: 10, beforeVal: 0, afterVal: 50 });
    aries.diskPages.set(10, { value: 50, pageLsn: l2.lsn });

    // Simulate recovery begins, writes CLR, but CRASHES AGAIN!
    const clr = aries.appendLog(1, 'CLR', l2.lsn, {
      pageId: 10,
      beforeVal: 50,
      afterVal: 0,
      undoNextLsn: l1.lsn,
    });
    aries.diskPages.set(10, { value: 0, pageLsn: clr.lsn });

    // Second recovery runs
    const res = aries.recover();

    // The CLR was not undone; page 10 remains 0
    assert.equal(aries.diskPages.get(10)?.value, 0);
  });
});
