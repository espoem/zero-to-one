// Single-producer / single-consumer ring buffer of Int32 values over a SharedArrayBuffer.
// Layout: [head, tail, ...slots]. The producer only writes `tail` and slots; the consumer only
// writes `head`. Atomics.load/store give the ordering: a slot is written BEFORE tail is published
// (store-release), and read AFTER tail is observed (load-acquire); JS Atomics are sequentially consistent.
const HEAD = 0;
const TAIL = 1;
const HEADER = 2;

export function createRing(capacity: number): SharedArrayBuffer {
  return new SharedArrayBuffer((HEADER + capacity) * Int32Array.BYTES_PER_ELEMENT);
}

export class Ring {
  private readonly a: Int32Array;
  private readonly cap: number;
  constructor(sab: SharedArrayBuffer) {
    this.a = new Int32Array(sab);
    this.cap = this.a.length - HEADER;
  }
  /** Producer side. Returns false when full (backpressure). */
  push(v: number): boolean {
    const tail = Atomics.load(this.a, TAIL);
    const head = Atomics.load(this.a, HEAD);
    if (tail - head === this.cap) return false;
    this.a[HEADER + (tail % this.cap)] = v;
    Atomics.store(this.a, TAIL, tail + 1); // publish after the slot write
    Atomics.notify(this.a, TAIL);
    return true;
  }
  /** Consumer side. Returns undefined when empty. */
  pop(): number | undefined {
    const head = Atomics.load(this.a, HEAD);
    const tail = Atomics.load(this.a, TAIL);
    if (head === tail) return undefined;
    const v = this.a[HEADER + (head % this.cap)]!;
    Atomics.store(this.a, HEAD, head + 1); // free the slot after reading it
    return v;
  }
  /** Consumer side, in a worker: block until data or timeout (never on the main thread). */
  waitForData(timeoutMs: number): 'ok' | 'not-equal' | 'timed-out' {
    const head = Atomics.load(this.a, HEAD);
    return Atomics.wait(this.a, TAIL, head, timeoutMs);
  }
}
