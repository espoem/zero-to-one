import { PassThrough } from "node:stream";
import type { ReactNode } from "react";
import { renderToPipeableStream, type RenderToPipeableStreamOptions } from "react-dom/server";

/** Render with Node streams and collect every chunk React writes, in order. */
export function streamChunks(
  node: ReactNode,
  options: RenderToPipeableStreamOptions = {},
): { shell: Promise<string>; all: Promise<string[]> } {
  const chunks: string[] = [];
  let resolveShell!: (s: string) => void;
  let resolveAll!: (c: string[]) => void;
  let rejectAll!: (e: unknown) => void;
  const shell = new Promise<string>((r) => (resolveShell = r));
  const all = new Promise<string[]>((r, j) => ((resolveAll = r), (rejectAll = j)));
  const sink = new PassThrough();
  sink.on("data", (d: Buffer) => chunks.push(d.toString()));
  sink.on("end", () => resolveAll(chunks));
  const stream = renderToPipeableStream(node, {
    ...options,
    onShellReady() {
      options.onShellReady?.();
      stream.pipe(sink);
      // The shell is flushed synchronously by pipe().
      queueMicrotask(() => resolveShell(chunks.join("")));
    },
    onShellError(e) {
      options.onShellError?.(e);
      rejectAll(e);
    },
  });
  return { shell, all };
}
