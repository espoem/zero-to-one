// HTTP helpers for module 07.
import type { IncomingMessage } from 'node:http';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Read a request body with a hard byte limit. Rejects early on a declared Content-Length above the
 * limit (no bytes read), and stops reading when an undeclared or lying body crosses it.
 * Invariant: at most `limit` bytes are ever buffered. The request is paused, not destroyed, so the
 * caller can still send a 413; it must answer with `Connection: close` so the unread rest is dropped.
 */
export function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? NaN);
    if (Number.isFinite(declared) && declared > limit)
      return reject(new HttpError(413, `declared ${declared} > ${limit}`));
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        cleanup();
        req.pause();
        return reject(new HttpError(413, `body exceeded ${limit} bytes`));
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, size));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
    };
    req.on('data', onData).on('end', onEnd).on('error', onError);
  });
}

/**
 * Retry only when it is safe: idempotent methods, and only for failures that happened before the
 * server could have processed the request (connection reset on a reused socket, refused connection).
 */
export async function withRetry<T>(
  method: string,
  attempt: (n: number) => Promise<T>,
  {
    retries = 2,
    isRetryable = defaultRetryable,
  }: { retries?: number; isRetryable?: (e: unknown) => boolean } = {},
): Promise<T> {
  const idempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method.toUpperCase());
  for (let n = 0; ; n++) {
    try {
      return await attempt(n);
    } catch (err) {
      if (!idempotent || n >= retries || !isRetryable(err)) throw err;
    }
  }
}

function defaultRetryable(err: unknown): boolean {
  const code =
    (err as { code?: string; cause?: { code?: string } }).code ??
    (err as { cause?: { code?: string } }).cause?.code;
  return code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'UND_ERR_SOCKET';
}
