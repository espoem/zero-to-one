// A minimal fixed-size worker pool (what piscina does, without the extras).
import { Worker } from 'node:worker_threads';

type TransferList = NonNullable<Parameters<Worker['postMessage']>[1]>;

interface Task {
  id: number;
  msg: Record<string, unknown>;
  transfer: TransferList;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

/**
 * Invariants:
 *  I1 at most `size` tasks run at once (one per worker);
 *  I2 every submitted task settles exactly once (resolve on reply, reject if its worker dies);
 *  I3 a dead worker is replaced, so capacity is restored.
 */
export class WorkerPool {
  private readonly idle: Worker[] = [];
  private readonly busy = new Map<Worker, Task>();
  private readonly queue: Task[] = [];
  private nextId = 0;
  private closed = false;
  peakConcurrency = 0;
  private readonly file: URL;

  constructor(file: URL, size: number) {
    this.file = file;
    for (let i = 0; i < size; i++) this.idle.push(this.spawn());
  }

  private spawn(): Worker {
    const w = new Worker(this.file);
    w.on('message', (m: { id: number; result: unknown }) => {
      const task = this.busy.get(w);
      this.busy.delete(w);
      task?.resolve(m.result);
      this.release(w);
    });
    w.on('error', (err) => {
      const task = this.busy.get(w);
      this.busy.delete(w);
      task?.reject(err as Error);
    });
    w.on('exit', () => {
      const i = this.idle.indexOf(w);
      if (i >= 0) this.idle.splice(i, 1);
      if (!this.closed) this.release(this.spawn()); // I3
    });
    return w;
  }

  private release(w: Worker): void {
    const next = this.queue.shift();
    if (next) this.start(w, next);
    else this.idle.push(w);
  }

  private start(w: Worker, t: Task): void {
    this.busy.set(w, t);
    this.peakConcurrency = Math.max(this.peakConcurrency, this.busy.size);
    w.postMessage({ id: t.id, ...t.msg }, t.transfer);
  }

  run<T>(msg: Record<string, unknown>, transfer: TransferList = []): Promise<T> {
    if (this.closed) return Promise.reject(new Error('pool closed'));
    return new Promise<T>((resolve, reject) => {
      const t: Task = {
        id: this.nextId++,
        msg,
        transfer,
        resolve: resolve as (v: unknown) => void,
        reject,
      };
      const w = this.idle.pop();
      if (w) this.start(w, t);
      else this.queue.push(t); // unbounded here; production pools cap the queue and reject (backpressure)
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.idle, ...this.busy.keys()].map((w) => w.terminate()));
  }
}
