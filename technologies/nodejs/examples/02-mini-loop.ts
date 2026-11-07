// A deterministic model of Node's event loop (libuv >= 1.45 phase order) with a virtual clock.
// It is a teaching model: it reproduces the orderings Node guarantees and nothing else.
type Cb = () => void;

interface Timer {
  due: number;
  seq: number;
  cb: Cb;
}

export class MiniLoop {
  now = 0;
  private seq = 0;
  private timers: Timer[] = [];
  private io: Cb[] = [];
  private check: Cb[] = [];
  private close: Cb[] = [];
  private tickQ: Cb[] = [];
  private microQ: Cb[] = [];
  readonly log: string[] = [];

  // ---- APIs exposed to "user code" ----
  setTimeout(cb: Cb, ms: number): void {
    const delay = !(ms >= 1 && ms <= 2 ** 31 - 1) ? 1 : Math.trunc(ms); // Node's clamping rule
    this.timers.push({ due: this.now + delay, seq: this.seq++, cb });
  }
  setImmediate(cb: Cb): void {
    this.check.push(cb);
  }
  nextTick(cb: Cb): void {
    this.tickQ.push(cb);
  }
  queueMicrotask(cb: Cb): void {
    this.microQ.push(cb);
  }
  /** Simulates an I/O completion delivered in a later poll phase. */
  completeIo(cb: Cb): void {
    this.io.push(cb);
  }
  onClose(cb: Cb): void {
    this.close.push(cb);
  }

  // ---- the loop ----
  /** Run a CommonJS-style entry point: script, then ticks before microtasks. */
  runMain(main: Cb): void {
    this.run(main);
    this.runTimers(); // libuv >= 1.45 runs expired timers once before the first iteration
    while (this.alive()) {
      for (const cb of this.io.splice(0)) this.run(cb); // poll
      const batch = this.check.splice(0); // snapshot: immediates added now wait one iteration
      for (const cb of batch) this.run(cb); // check
      for (const cb of this.close.splice(0)) this.run(cb); // close callbacks
      if (this.check.length === 0 && this.io.length === 0 && this.timers.length > 0) {
        this.now = Math.max(this.now, Math.min(...this.timers.map((t) => t.due))); // "block" in poll
      }
      this.runTimers(); // timers
    }
  }

  private alive(): boolean {
    return this.timers.length + this.io.length + this.check.length + this.close.length > 0;
  }

  private runTimers(): void {
    for (;;) {
      const expired = this.timers
        .filter((t) => t.due <= this.now)
        .sort((a, b) => a.due - b.due || a.seq - b.seq);
      const first = expired[0];
      if (!first) return;
      this.timers.splice(this.timers.indexOf(first), 1);
      this.run(first.cb);
    }
  }

  private run(cb: Cb): void {
    cb();
    this.drain();
  }

  /** processTicksAndRejections: all ticks, then all microtasks, until both are empty. */
  private drain(): void {
    do {
      while (this.tickQ.length) this.tickQ.shift()!();
      while (this.microQ.length) this.microQ.shift()!();
    } while (this.tickQ.length);
  }
}
