/**
 * Thin test helper over Solid's own dev diagnostics channel.
 *
 * `OBSERVE.diagnostics.capture()` is the public capture API exported by
 * `solid-js` (dev and observe builds only; `OBSERVE` is `undefined` in the
 * production build). Nothing here re-implements Solid: it only collects the
 * diagnostic codes the real runtime emitted while `fn` ran.
 */
import { OBSERVE, type DiagnosticEvent } from "solid-js";

export function hasObserve(): boolean {
  return OBSERVE !== undefined;
}

export function captureDiagnostics<T>(fn: () => T): { result: T; codes: string[]; events: DiagnosticEvent[] } {
  if (!OBSERVE) throw new Error("diagnostics need the development or observe build of solid-js");
  const capture = OBSERVE.diagnostics.capture();
  let result!: T;
  let events: DiagnosticEvent[] = [];
  try {
    result = fn();
  } finally {
    // stop() runs even when fn throws, so a failing test never leaks a capture
    events = capture.stop();
  }
  return { result, codes: events.map((e) => e.code), events };
}

export async function captureDiagnosticsAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; codes: string[]; events: DiagnosticEvent[] }> {
  if (!OBSERVE) throw new Error("diagnostics need the development or observe build of solid-js");
  const capture = OBSERVE.diagnostics.capture();
  let result!: T;
  let events: DiagnosticEvent[] = [];
  try {
    result = await fn();
  } finally {
    events = capture.stop();
  }
  return { result, codes: events.map((e) => e.code), events };
}

/** A promise you settle by hand: async tests stay deterministic (no timers). */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let queued microtasks (and Solid's microtask flush) run. */
export async function tick(times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

/** Drain microtasks and one macrotask turn (promise chains of any depth). */
export function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
