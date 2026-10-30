import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface Frame {
  frameId: number;
  pageId: number | null;
  data: Uint8Array;
  pinCount: number;
  isDirty: boolean;
  usageBit: number; // 0 or 1 for CLOCK sweep
  pageLsn: bigint;
}

export class BufferPoolManager {
  readonly poolSize: number;
  readonly frames: Frame[];
  readonly pageTable: Map<number, number>; // pageId -> frameId
  clockHand = 0;
  flushedLsn = 0n; // Disk WAL LSN
  readonly diskStorage: Map<number, Uint8Array>;

  constructor(poolSize = 4) {
    this.poolSize = poolSize;
    this.frames = Array.from({ length: poolSize }, (_, i) => ({
      frameId: i,
      pageId: null,
      data: new Uint8Array(4096),
      pinCount: 0,
      isDirty: false,
      usageBit: 0,
      pageLsn: 0n,
    }));
    this.pageTable = new Map();
    this.diskStorage = new Map();
  }

  fetchPage(pageId: number): Frame {
    // 1. Check if already in buffer pool
    if (this.pageTable.has(pageId)) {
      const frameId = this.pageTable.get(pageId)!;
      const frame = this.frames[frameId]!;
      frame.pinCount++;
      frame.usageBit = 1;
      return frame;
    }

    // 2. Need to evict a page via CLOCK sweep
    const victimFrame = this.findVictimFrame();
    if (!victimFrame) {
      throw new Error('All buffer frames are currently pinned! Buffer pool exhausted.');
    }

    // 3. Flush victim if dirty
    if (victimFrame.isDirty && victimFrame.pageId !== null) {
      this.flushPage(victimFrame.pageId);
    }

    // 4. Remove old page from page table
    if (victimFrame.pageId !== null) {
      this.pageTable.delete(victimFrame.pageId);
    }

    // 5. Read new page from disk (or initialize)
    const diskData = this.diskStorage.get(pageId) ?? new Uint8Array(4096);
    victimFrame.pageId = pageId;
    victimFrame.data.set(diskData);
    victimFrame.pinCount = 1;
    victimFrame.isDirty = false;
    victimFrame.usageBit = 1;
    victimFrame.pageLsn = 0n;

    this.pageTable.set(pageId, victimFrame.frameId);
    return victimFrame;
  }

  unpinPage(pageId: number, isDirty: boolean): void {
    const frameId = this.pageTable.get(pageId);
    if (frameId === undefined) return;

    const frame = this.frames[frameId]!;
    if (frame.pinCount > 0) {
      frame.pinCount--;
    }
    if (isDirty) {
      frame.isDirty = true;
    }
  }

  flushPage(pageId: number): void {
    const frameId = this.pageTable.get(pageId);
    if (frameId === undefined) return;

    const frame = this.frames[frameId]!;
    // Enforce WAL Invariant: flushed_lsn >= page_lsn
    if (this.flushedLsn < frame.pageLsn) {
      throw new Error(
        `WAL Invariant Violation: flushedLsn (${this.flushedLsn}) < pageLsn (${frame.pageLsn}). Cannot flush dirty page before WAL!`
      );
    }

    this.diskStorage.set(pageId, new Uint8Array(frame.data));
    frame.isDirty = false;
  }

  private findVictimFrame(): Frame | null {
    // CLOCK sweep: search up to 2 full rotations
    for (let attempts = 0; attempts < this.poolSize * 2; attempts++) {
      const frame = this.frames[this.clockHand]!;
      this.clockHand = (this.clockHand + 1) % this.poolSize;

      if (frame.pinCount === 0) {
        if (frame.usageBit === 0) {
          return frame; // Found victim
        } else {
          frame.usageBit = 0; // Second chance
        }
      }
    }
    return null;
  }
}

describe('Buffer Pool Manager & CLOCK Replacement Policy', () => {
  it('correctly loads pages into frames and tracks pin counts', () => {
    const bpm = new BufferPoolManager(3);

    const f1 = bpm.fetchPage(1);
    assert.equal(f1.pageId, 1);
    assert.equal(f1.pinCount, 1);

    const f2 = bpm.fetchPage(2);
    assert.equal(f2.pageId, 2);
    assert.equal(f2.pinCount, 1);

    // Fetch page 1 again: increments pinCount without reading from disk
    const f1Again = bpm.fetchPage(1);
    assert.equal(f1Again.frameId, f1.frameId);
    assert.equal(f1Again.pinCount, 2);

    bpm.unpinPage(1, false);
    bpm.unpinPage(1, false);
    assert.equal(f1.pinCount, 0);
  });

  it('evicts unpinned pages using CLOCK second-chance sweep', () => {
    const bpm = new BufferPoolManager(2); // Pool size = 2

    bpm.fetchPage(10); // Frame 0, usage=1
    bpm.unpinPage(10, false); // pinCount=0, usage=1

    bpm.fetchPage(20); // Frame 1, usage=1
    bpm.unpinPage(20, false); // pinCount=0, usage=1

    // Access page 10 again to give it a second chance (usageBit = 1)
    bpm.fetchPage(10);
    bpm.unpinPage(10, false);

    // Fetch page 30: requires eviction
    // Clock sweeps: Frame 0 (page 10) usage was 1 -> flipped to 0
    // Frame 1 (page 20) usage was 1 -> flipped to 0
    // Second round: Frame 0 (page 10) or Frame 1 is evicted
    bpm.fetchPage(30);

    // Page table contains 2 pages
    assert.equal(bpm.pageTable.size, 2);
    assert.equal(bpm.pageTable.has(30), true);
  });

  it('strictly enforces the Write-Ahead Log invariant before dirty page flush', () => {
    const bpm = new BufferPoolManager(2);

    const f = bpm.fetchPage(100);
    f.data[0] = 42;
    f.pageLsn = 500n; // Page updated under transaction LSN 500
    bpm.unpinPage(100, true); // Marked dirty

    // Attempting to flush when disk WAL LSN is only 400 must throw!
    bpm.flushedLsn = 400n;
    assert.throws(
      () => bpm.flushPage(100),
      /WAL Invariant Violation.*Cannot flush dirty page before WAL/
    );

    // Once WAL is fsynced up to LSN 500, flush succeeds
    bpm.flushedLsn = 500n;
    bpm.flushPage(100);
    assert.equal(bpm.frames[f.frameId]!.isDirty, false);
    assert.equal(bpm.diskStorage.get(100)?.[0], 42);
  });
});
