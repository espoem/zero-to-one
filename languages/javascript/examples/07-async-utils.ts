// Module 07 · Async utilities, written in TypeScript (erasable syntax only, runs natively on Node 26).

export function promiseAll<T>(iterable: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]> {
  return new Promise((resolve, reject) => {
    const results: Awaited<T>[] = [];
    let pending = 0;
    let index = 0;
    for (const item of iterable) {
      const i = index++;
      pending++;
      Promise.resolve(item).then((value) => {
        results[i] = value as Awaited<T>;
        if (--pending === 0) resolve(results);
      }, reject);
    }
    if (pending === 0) resolve(results);
  });
}

/** Run fn over items with at most `limit` calls in flight; stops pulling new items after a failure. */
export async function mapWithConcurrency<T, R>(
  items: Iterable<T>,
  limit: number,
  fn: (item: T, index: number, signal: AbortSignal) => Promise<R>,
  { signal }: { signal?: AbortSignal } = {},
): Promise<R[]> {
  const results: R[] = [];
  const iterator = Array.from(items).entries();
  const failFast = new AbortController();
  const combined = signal ? AbortSignal.any([signal, failFast.signal]) : failFast.signal;
  async function worker(): Promise<void> {
    for (const [i, item] of iterator) {
      combined.throwIfAborted();
      try {
        results[i] = await fn(item, i, combined);
      } catch (e) {
        failFast.abort(e);
        throw e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  return results;
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export const defaultSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const onAbort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  signal?: AbortSignal;
  sleep?: Sleep;
  random?: () => number;
  isRetryable?: (e: unknown) => boolean;
}

/** Retry with exponential backoff and full jitter. */
export async function retry<T>(
  op: (attempt: number, signal: AbortSignal) => Promise<T>,
  { retries = 3, baseMs = 100, maxMs = 5_000, signal, sleep = defaultSleep, random = Math.random,
    isRetryable = () => true }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await op(attempt, signal ?? new AbortController().signal);
    } catch (e) {
      if (attempt >= retries || !isRetryable(e) || signal?.aborted) throw e;
      const cap = Math.min(maxMs, baseMs * 2 ** attempt);
      await sleep(random() * cap, signal);
    }
  }
}

export interface Clock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

export const realClock: Clock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

/** Trailing-edge debounce. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number, clock: Clock = realClock) {
  let handle: unknown;
  return (...args: A) => {
    if (handle !== undefined) clock.clearTimeout(handle);
    handle = clock.setTimeout(() => { handle = undefined; fn(...args); }, ms);
  };
}

/** Leading-edge throttle: at most one call per `ms`. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number, clock: Clock = realClock) {
  let last = -Infinity;
  return (...args: A) => {
    const t = clock.now();
    if (t - last >= ms) { last = t; fn(...args); }
  };
}
