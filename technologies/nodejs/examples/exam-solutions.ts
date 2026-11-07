// Reference solutions for the hands-on tasks (H1–H6) in exams/interview.md.
import type { Server } from 'node:http';
import { Transform, type TransformCallback, type Writable } from 'node:stream';
import { Worker } from 'node:worker_threads';

type TransferList = NonNullable<Parameters<Worker['postMessage']>[1]>;

/**
 * H1 · promisifyOnce(fn)
 * Converts an error-first callback function to a Promise-returning function,
 * ensuring that multiple callback invocations are guarded: only the first settles the promise.
 */
export function promisifyOnce<T = unknown>(
  fn: (...args: any[]) => void,
): (...args: any[]) => Promise<T> {
  return (...args: any[]) =>
    new Promise<T>((resolve, reject) => {
      let settled = false;
      try {
        fn(...args, (err: Error | null | undefined, result: T) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      } catch (syncErr) {
        if (!settled) {
          settled = true;
          reject(syncErr);
        }
      }
    });
}

/**
 * H2 · FrameDecoder
 * Decodes length-prefixed frames: [u32 big-endian length][payload] ...
 * Rejects frames exceeding maxFrame with code 'E_FRAME_TOO_LARGE'.
 * Emits code 'E_TRUNCATED' on flush if unparsed trailing bytes remain.
 */
export class FrameDecoder extends Transform {
  private pending: Buffer = Buffer.alloc(0);
  private readonly maxFrame: number;

  constructor(maxFrame = 1 << 20) {
    super({ readableObjectMode: true });
    this.maxFrame = maxFrame;
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    while (this.pending.length >= 4) {
      const len = this.pending.readUInt32BE(0);
      if (len > this.maxFrame) {
        return cb(
          Object.assign(new Error(`frame of ${len} bytes exceeds max ${this.maxFrame}`), {
            code: 'E_FRAME_TOO_LARGE',
          }),
        );
      }
      if (this.pending.length < 4 + len) {
        break;
      }
      // Copy slice so we do not pin the upstream buffer chunk
      this.push(Buffer.from(this.pending.subarray(4, 4 + len)));
      this.pending = this.pending.subarray(4 + len);
    }
    cb();
  }

  override _flush(cb: TransformCallback): void {
    if (this.pending.length > 0) {
      cb(
        Object.assign(new Error(`truncated frame: ${this.pending.length} unconsumed bytes`), {
          code: 'E_TRUNCATED',
        }),
      );
    } else {
      cb();
    }
  }
}

/** Encodes a payload Buffer into a length-prefixed frame: [4-byte BE length][payload]. */
export function encodeFrame(payload: Buffer): Buffer {
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

/**
 * H3 · writeWithBackpressure(writable, chunks)
 * Writes chunks to a Writable stream respecting backpressure:
 * pauses on write() returning false until 'drain', rejects on stream 'error' or closure,
 * and cleans up all listeners.
 */
export async function writeWithBackpressure(
  writable: Writable,
  chunks: Iterable<Uint8Array | string> | AsyncIterable<Uint8Array | string>,
): Promise<void> {
  if (writable.destroyed || (writable as { errored?: Error }).errored) {
    throw (writable as { errored?: Error }).errored ?? new Error('stream already destroyed');
  }

  let streamError: Error | null = null;
  const onError = (err: Error) => {
    streamError = err;
  };
  writable.on('error', onError);

  try {
    for await (const chunk of chunks) {
      if (streamError) throw streamError;
      if (writable.destroyed) throw new Error('stream destroyed while writing');

      const ok = writable.write(chunk);
      if (!ok) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            cleanup();
            resolve();
          };
          const onLocalError = (err: Error) => {
            cleanup();
            reject(err);
          };
          const onClose = () => {
            cleanup();
            reject(new Error('stream closed before drain'));
          };
          function cleanup() {
            writable.off('drain', onDrain);
            writable.off('error', onLocalError);
            writable.off('close', onClose);
          }
          writable.once('drain', onDrain);
          writable.once('error', onLocalError);
          writable.once('close', onClose);
        });
      }
    }
  } finally {
    writable.off('error', onError);
  }
}

/**
 * H4 · withTimeout(work, ms, parentSignal)
 * Runs work with a timeout. Cancels the work via AbortSignal when the deadline expires
 * or parent signal fires. Ensures timers are cleared and never outlive the execution.
 */
export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  parentSignal?.throwIfAborted();
  const timeout = AbortSignal.timeout(ms);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
  signal.throwIfAborted();

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };

    function cleanup() {
      signal.removeEventListener('abort', onAbort);
    }

    signal.addEventListener('abort', onAbort, { once: true });

    work(signal).then(
      (val) => {
        cleanup();
        resolve(val);
      },
      (err) => {
        cleanup();
        reject(err);
      },
    );
  });
}

interface WorkerTask {
  id: number;
  msg: Record<string, unknown>;
  transfer: TransferList;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

/**
 * H5 · WorkerPool
 * Fixed-size worker thread pool with a bounded backlog queue that rejects when full.
 * Replaces crashed workers to preserve capacity.
 */
export class WorkerPool {
  private readonly idle: Worker[] = [];
  private readonly busy = new Map<Worker, WorkerTask>();
  private readonly queue: WorkerTask[] = [];
  private nextId = 0;
  private closed = false;
  peakConcurrency = 0;
  private readonly file: URL;
  private readonly maxQueue: number;

  constructor(file: URL, size: number, maxQueue = 100) {
    this.file = file;
    this.maxQueue = maxQueue;
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
      if (!this.closed) this.release(this.spawn());
    });
    return w;
  }

  private release(w: Worker): void {
    const next = this.queue.shift();
    if (next) this.start(w, next);
    else this.idle.push(w);
  }

  private start(w: Worker, t: WorkerTask): void {
    this.busy.set(w, t);
    this.peakConcurrency = Math.max(this.peakConcurrency, this.busy.size);
    w.postMessage({ id: t.id, ...t.msg }, t.transfer);
  }

  run<T>(msg: Record<string, unknown>, transfer: TransferList = []): Promise<T> {
    if (this.closed) return Promise.reject(new Error('pool closed'));
    if (this.idle.length === 0 && this.queue.length >= this.maxQueue) {
      return Promise.reject(new Error('queue full'));
    }
    return new Promise<T>((resolve, reject) => {
      const t: WorkerTask = {
        id: this.nextId++,
        msg,
        transfer,
        resolve: resolve as (v: unknown) => void,
        reject,
      };
      const w = this.idle.pop();
      if (w) this.start(w, t);
      else this.queue.push(t);
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const t of this.queue) {
      t.reject(new Error('pool closed'));
    }
    this.queue.length = 0;
    await Promise.all([...this.idle, ...this.busy.keys()].map((w) => w.terminate()));
  }
}

/** In-process task pool alternative for environments without worker threads. */
export class TaskPool {
  private running = 0;
  private readonly queue: Array<() => void> = [];
  private readonly concurrency: number;
  private readonly maxQueue: number;
  private closed = false;

  constructor(concurrency: number, maxQueue = 100) {
    this.concurrency = concurrency;
    this.maxQueue = maxQueue;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.closed) throw new Error('pool closed');
    if (this.running >= this.concurrency && this.queue.length >= this.maxQueue) {
      throw new Error('queue full');
    }
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    if (this.closed) throw new Error('pool closed');
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      next?.();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

export interface ShutdownResult {
  forced: boolean;
}

/**
 * H6 · gracefulShutdown(server, deadlineMs)
 * Gracefully shuts down a node:http Server:
 * 1. Closes idle keep-alive connections immediately.
 * 2. Stops accepting new connections.
 * 3. Waits for in-flight requests to complete up to deadlineMs.
 * 4. Forces closeAllConnections() if the deadline is exceeded.
 */
export function gracefulShutdown(server: Server, deadlineMs = 5000): Promise<ShutdownResult> {
  return new Promise((resolve) => {
    let forced = false;
    let finished = false;

    const timer = setTimeout(() => {
      forced = true;
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }, deadlineMs);
    timer.unref?.();

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    const interval = setInterval(() => {
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
    }, 10);
    interval.unref?.();

    server.close(() => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(interval);
      resolve({ forced });
    });
  });
}

/**
 * Installs graceful shutdown handlers on process SIGTERM and SIGINT for a node:http Server.
 */
export function installGracefulShutdown(server: Server, deadlineMs = 5000): void {
  let shuttingDown = false;
  const onSignal = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`shutting down after ${signal}\n`);
    const { forced } = await gracefulShutdown(server, deadlineMs);
    if (forced) {
      process.stderr.write('shutdown deadline exceeded\n');
      process.exit(1);
    } else {
      process.stdout.write(`closed cleanly after ${signal}\n`);
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void onSignal('SIGTERM'));
  process.once('SIGINT', () => void onSignal('SIGINT'));
}
