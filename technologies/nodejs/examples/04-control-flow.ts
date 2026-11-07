// Small, production-shaped control-flow utilities used in module 04.

/** Run `work` with a deadline. The work receives a signal that aborts on timeout OR parent abort,
 *  so the losing side is cancelled; the timer never outlives the call. */
export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parent?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(ms);
  const signal = parent ? AbortSignal.any([parent, timeout]) : timeout;
  signal.throwIfAborted();
  return await work(signal);
}

/** Guard an error-first callback so a buggy producer cannot call it twice. */
export function onceCallback<A extends unknown[]>(
  cb: (err: Error | null, ...rest: A) => void,
  onDuplicate: (err: Error) => void = (e) => process.emitWarning(e),
): (err: Error | null, ...rest: A) => void {
  let called = false;
  return (err, ...rest) => {
    if (called) {
      onDuplicate(new Error('callback called more than once'));
      return;
    }
    called = true;
    cb(err, ...rest);
  };
}

/** Wrap an async request handler so a rejection becomes a response, never an unhandled rejection. */
export function safeHandler<
  Req,
  Res extends { statusCode: number; end(body?: string): void; headersSent?: boolean },
>(
  handler: (req: Req, res: Res) => Promise<void>,
  report: (err: unknown) => void,
): (req: Req, res: Res) => void {
  return (req, res) => {
    handler(req, res).catch((err: unknown) => {
      report(err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('internal error');
      }
    });
  };
}
