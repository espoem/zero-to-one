import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Slotted Page Implementation:
 * Fixed 8KB (8192 bytes) page buffer.
 * Page layout:
 * - Header (16 bytes): [page_lsn: 8B, lower_offset: 2B, upper_offset: 2B, item_count: 2B, reserved: 2B]
 * - Line Pointers (Item pointers): 4 bytes each [offset: 2B, length: 2B]
 * - Free space gap: between lower_offset and upper_offset
 * - Tuple Heap: grows downward from 8192 toward lower_offset
 */
export class SlottedPage {
  static readonly PAGE_SIZE = 8192;
  static readonly HEADER_SIZE = 16;
  static readonly ITEM_POINTER_SIZE = 4;

  readonly buffer: Uint8Array;
  readonly view: DataView;

  constructor(buffer?: Uint8Array) {
    if (buffer) {
      assert.equal(buffer.length, SlottedPage.PAGE_SIZE, 'Buffer must be 8192 bytes');
      this.buffer = buffer;
    } else {
      this.buffer = new Uint8Array(SlottedPage.PAGE_SIZE);
    }
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);

    if (!buffer) {
      // Initialize new page
      this.pageLsn = 0n;
      this.lowerOffset = SlottedPage.HEADER_SIZE;
      this.upperOffset = SlottedPage.PAGE_SIZE;
      this.itemCount = 0;
    }
  }

  get pageLsn(): bigint {
    return this.view.getBigUint64(0, true);
  }

  set pageLsn(val: bigint) {
    this.view.setBigUint64(0, val, true);
  }

  get lowerOffset(): number {
    return this.view.getUint16(8, true);
  }

  set lowerOffset(val: number) {
    this.view.setUint16(8, val, true);
  }

  get upperOffset(): number {
    return this.view.getUint16(10, true);
  }

  set upperOffset(val: number) {
    this.view.setUint16(10, val, true);
  }

  get itemCount(): number {
    return this.view.getUint16(12, true);
  }

  set itemCount(val: number) {
    this.view.setUint16(12, val, true);
  }

  get freeSpace(): number {
    return this.upperOffset - this.lowerOffset;
  }

  insert(data: Uint8Array): number | null {
    const needed = SlottedPage.ITEM_POINTER_SIZE + data.length;
    if (this.freeSpace < needed) {
      return null; // Page full
    }

    const newUpper = this.upperOffset - data.length;
    this.buffer.set(data, newUpper);

    const slotIndex = this.itemCount;
    const pointerOffset = SlottedPage.HEADER_SIZE + slotIndex * SlottedPage.ITEM_POINTER_SIZE;

    this.view.setUint16(pointerOffset, newUpper, true);
    this.view.setUint16(pointerOffset + 2, data.length, true);

    this.upperOffset = newUpper;
    this.lowerOffset = pointerOffset + SlottedPage.ITEM_POINTER_SIZE;
    this.itemCount = slotIndex + 1;

    return slotIndex;
  }

  get(slotIndex: number): Uint8Array | null {
    if (slotIndex < 0 || slotIndex >= this.itemCount) return null;
    const pointerOffset = SlottedPage.HEADER_SIZE + slotIndex * SlottedPage.ITEM_POINTER_SIZE;
    const offset = this.view.getUint16(pointerOffset, true);
    const length = this.view.getUint16(pointerOffset + 2, true);

    if (offset === 0 && length === 0) return null; // Deleted
    return this.buffer.slice(offset, offset + length);
  }

  delete(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.itemCount) return false;
    const pointerOffset = SlottedPage.HEADER_SIZE + slotIndex * SlottedPage.ITEM_POINTER_SIZE;
    const offset = this.view.getUint16(pointerOffset, true);
    const length = this.view.getUint16(pointerOffset + 2, true);

    if (offset === 0 && length === 0) return false;

    // Mark as deleted tombstone
    this.view.setUint16(pointerOffset, 0, true);
    this.view.setUint16(pointerOffset + 2, 0, true);
    return true;
  }

  compact(): void {
    // Collect all active tuples
    const active: { slotIndex: number; data: Uint8Array }[] = [];
    for (let i = 0; i < this.itemCount; i++) {
      const data = this.get(i);
      if (data !== null) {
        active.push({ slotIndex: i, data });
      }
    }

    // Reset upper offset to bottom of page
    let currentUpper = SlottedPage.PAGE_SIZE;
    for (const item of active) {
      currentUpper -= item.data.length;
      this.buffer.set(item.data, currentUpper);

      const pointerOffset = SlottedPage.HEADER_SIZE + item.slotIndex * SlottedPage.ITEM_POINTER_SIZE;
      this.view.setUint16(pointerOffset, currentUpper, true);
      this.view.setUint16(pointerOffset + 2, item.data.length, true);
    }

    this.upperOffset = currentUpper;
  }
}

describe('Slotted Page Storage Architecture', () => {
  it('correctly inserts and retrieves variable-length tuples', () => {
    const page = new SlottedPage();
    assert.equal(page.itemCount, 0);
    assert.equal(page.freeSpace, 8192 - 16);

    const tuple1 = new TextEncoder().encode('Alice in Wonderland');
    const tuple2 = new TextEncoder().encode('Distributed Data Systems');
    const tuple3 = new TextEncoder().encode('Database Internals');

    const slot0 = page.insert(tuple1);
    const slot1 = page.insert(tuple2);
    const slot2 = page.insert(tuple3);

    assert.equal(slot0, 0);
    assert.equal(slot1, 1);
    assert.equal(slot2, 2);
    assert.equal(page.itemCount, 3);

    assert.deepEqual(page.get(0), tuple1);
    assert.deepEqual(page.get(1), tuple2);
    assert.deepEqual(page.get(2), tuple3);
  });

  it('preserves slot index indirection and consolidates free space upon compaction', () => {
    const page = new SlottedPage();
    const t0 = new Uint8Array(100).fill(1);
    const t1 = new Uint8Array(200).fill(2);
    const t2 = new Uint8Array(300).fill(3);

    page.insert(t0);
    page.insert(t1);
    page.insert(t2);

    const freeBeforeDelete = page.freeSpace;
    assert.equal(page.delete(1), true); // Delete middle tuple
    assert.equal(page.get(1), null);

    // Free space remains unchanged until compaction
    assert.equal(page.freeSpace, freeBeforeDelete);

    page.compact();

    // Free space increased by exactly the 200 bytes of deleted tuple t1
    assert.equal(page.freeSpace, freeBeforeDelete + 200);

    // Slot 0 and Slot 2 remain accessible with identical indices
    assert.deepEqual(page.get(0), t0);
    assert.deepEqual(page.get(2), t2);
  });

  it('property-based: arbitrary insertions and deletions maintain integrity under compaction', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uint8Array({ minLength: 10, maxLength: 200 }), { minLength: 5, maxLength: 20 }),
        (items) => {
          const page = new SlottedPage();
          const inserted: { slot: number; data: Uint8Array }[] = [];

          for (const item of items) {
            const slot = page.insert(item);
            if (slot !== null) {
              inserted.push({ slot, data: item });
            }
          }

          // Randomly delete half the items
          for (let i = 0; i < inserted.length; i += 2) {
            page.delete(inserted[i]!.slot);
          }

          page.compact();

          // Verify surviving items are exact
          for (let i = 1; i < inserted.length; i += 2) {
            const retrieved = page.get(inserted[i]!.slot);
            assert.deepEqual(retrieved, inserted[i]!.data);
          }
        }
      )
    );
  });
});
