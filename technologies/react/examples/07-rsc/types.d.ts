// Minimal declarations for react-server-dom-webpack@19.3.1 (the package ships no types).
declare module "react-server-dom-webpack/server" {
  import type { ReactNode } from "react";
  import type { Writable } from "node:stream";
  export function renderToPipeableStream(
    model: ReactNode,
    webpackMap: Record<string, { id: string; chunks: string[]; name: string }>,
    options?: { onError?: (e: unknown) => string | void },
  ): { pipe<T extends Writable>(destination: T): T; abort(reason?: unknown): void };
  export function registerClientReference<T>(proxy: T, id: string, exportName: string): T;
  export function registerServerReference<T>(fn: T, id: string, exportName: string | null): T;
  export function decodeReply<T = unknown>(body: string | FormData, serverManifest: unknown): Promise<T>;
}
declare module "react-server-dom-webpack/client.node" {
  import type { Readable } from "node:stream";
  export function createFromNodeStream<T = unknown>(
    stream: Readable,
    manifest: {
      moduleMap: Record<string, Record<string, { id: string; chunks: string[]; name: string }>>;
      serverModuleMap: unknown;
      moduleLoading: unknown;
    },
    options?: { findSourceMapURL?: unknown },
  ): Promise<T>;
  export function encodeReply(value: unknown): Promise<string | FormData>;
}
