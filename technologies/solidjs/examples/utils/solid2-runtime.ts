/**
 * SolidJS 2.0 RC (`solid-js@2.0.0-rc.18`, `@solidjs/signals`, `@solidjs/web`)
 * Native Runtime Facade & Headless Test Harness.
 *
 * The reactive engine, stores, context, control-flow components, and response
 * helpers below are the official published packages — imported directly, with
 * no synthetic reimplementation. Run Node with the `browser` export condition
 * (`node --conditions=browser ...`) so `solid-js` / `@solidjs/web` resolve to
 * their client reactive builds instead of the SSR server no-op builds.
 *
 * The file additionally keeps the minimal headless harness the Node CLI
 * examples require (they run in Node with no DOM or Vite dev server):
 * - `resolveClass` (class-name resolution helper).
 * - Headless control-flow test runners: `renderFor`, `renderRepeat`, `renderShow`.
 * - Headless programmatic boundaries: `createLoadingBoundary`, `createErroredBoundary`.
 * - Server-functions test harness: `configureServerFunctionsServer`,
 *   `handleServerFunctionRequest`, `invoke`, `provideRequestEvent`,
 *   `getRequestEvent`, `registerServerFunction`, `isServerFunction`,
 *   `getServerFunctionMetadata`, `GET`, `withMeta`.
 *
 * NOTE: request scope stays in this harness (`provideRequestEvent` /
 * `getRequestEvent`) because `@solidjs/web/storage`'s scope helpers are only
 * implemented in the server build and throw in the browser build the examples
 * resolve to. Response envelopes and safe-error branding ARE native
 * (`@solidjs/web`); the harness interoperates with them.
 */

// ============================================================================
// 1. Native reactive core, stores, context, and flow components (`solid-js`)
// ============================================================================

export {
  createSignal,
  createMemo,
  createEffect,
  createRenderEffect,
  createReaction,
  createRoot,
  runWithOwner,
  getOwner,
  untrack,
  onCleanup,
  onSettled,
  flush,
  createStore,
  createProjection,
  createOptimistic,
  createOptimisticStore,
  reconcile,
  deep,
  merge,
  omit,
  action,
  refresh,
  isPending,
  latest,
  createContext,
  useContext,
  Show,
  Switch,
  Match,
  For,
  Repeat,
  Loading,
  Reveal,
  Errored,
  NotReadyError,
  resolve,
} from "solid-js";

export type {
  Accessor,
  Setter,
  Signal,
  Owner,
  Context,
  Element,
  Store,
  StoreSetter,
  ArrayFilterFn,
  MemoOptions,
  EffectOptions,
  SignalOptions,
  ProjectionOptions,
  StoreOptions,
  UntilOptions,
} from "solid-js";

// ============================================================================
// 2. Native signal/store paths, fatal context errors, and async helpers
// ============================================================================

export { storePath, snapshot, ContextNotFoundError, until, affects } from "@solidjs/signals";

// ============================================================================
// 3. Native web runtime: refs, response envelopes, and Dynamic (`@solidjs/web`)
// ============================================================================

export {
  applyRef,
  respond,
  redirect,
  reload,
  markSafeError,
  isSafeError,
  isResponseEnvelope,
  REVALIDATE_HEADER,
  Dynamic,
  dynamic,
} from "@solidjs/web";

export type { ResponseEnvelope } from "@solidjs/web";

import {
  createMemo as nativeCreateMemo,
  createSignal as nativeCreateSignal,
} from "solid-js";
import {
  createLoadingBoundary as nativeCreateLoadingBoundary,
  createErrorBoundary as nativeCreateErrorBoundary,
} from "@solidjs/signals";
import { NotReadyError as NativeNotReadyError } from "solid-js";
import { isResponseEnvelope as nativeIsResponseEnvelope, isSafeError as nativeIsSafeError } from "@solidjs/web";
import type { Accessor as NativeAccessor } from "solid-js";

// ============================================================================
// 4. Headless class-name helper
// ============================================================================

export type ClassValue =
  | string
  | false
  | null
  | undefined
  | Record<string, boolean | undefined | null>
  | ClassValue[];

export function resolveClass(value: ClassValue): string {
  const classes: string[] = [];
  const visit = (item: ClassValue) => {
    if (!item) return;
    if (typeof item === "string") {
      for (const token of item.trim().split(/\s+/)) {
        if (token) classes.push(token);
      }
    } else if (Array.isArray(item)) {
      for (const child of item) visit(child);
    } else if (typeof item === "object") {
      for (const [k, enabled] of Object.entries(item)) {
        if (enabled) classes.push(k);
      }
    }
  };
  visit(value);
  return Array.from(new Set(classes)).join(" ");
}

// ============================================================================
// 5. Headless control-flow test runners (`<For>` / `<Repeat>` / `<Show>`)
// ============================================================================

/**
 * Solid 2.0 Unified `<For>` helper:
 * - Default (`keyed?: true`): `(item: T, index: Accessor<number>) => R`
 * - Positional (`keyed: false`, replaces `<Index>`): `(item: Accessor<T>, index: number) => R`
 * - Custom Key (`keyed: (item: T) => Key`): `(item: Accessor<T>, index: Accessor<number>) => R`
 */
export function renderFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: false; fallback?: () => R },
  children: (item: NativeAccessor<T>, index: number) => R
): R[];
export function renderFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: (item: T) => unknown; fallback?: () => R },
  children: (item: NativeAccessor<T>, index: NativeAccessor<number>) => R
): R[];
export function renderFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed?: true; fallback?: () => R } | undefined,
  children: (item: T, index: NativeAccessor<number>) => R
): R[];
export function renderFor<T, R>(
  each: readonly T[] | undefined | null,
  options:
    | { keyed?: boolean | ((item: T) => unknown); fallback?: () => R }
    | undefined,
  children: (item: any, index: any) => R
): R[] {
  if (!each || each.length === 0) {
    return options?.fallback ? [options.fallback()] : [];
  }
  const keyed = options?.keyed ?? true;
  return each.map((item, idx) => {
    if (keyed === false) {
      return children(() => each[idx]!, idx);
    }
    if (typeof keyed === "function") {
      return children(() => item, () => idx);
    }
    return children(item, () => idx);
  });
}

/**
 * Solid 2.0 `<Repeat>` helper:
 * Renders `count` positional slots starting at `from` (default 0) without array diffing.
 */
export function renderRepeat<R>(
  options: { count: number; from?: number; fallback?: () => R },
  children: (index: number) => R
): R[] {
  const { count, from = 0, fallback } = options;
  if (count <= 0) {
    return fallback ? [fallback()] : [];
  }
  const out: R[] = [];
  for (let i = 0; i < count; i++) {
    out.push(children(from + i));
  }
  return out;
}

export function renderShow<T, R>(
  when: T | undefined | null | false,
  children: (item: NativeAccessor<NonNullable<T>>) => R,
  fallback?: () => R
): R | null {
  if (when) {
    return children(() => when as NonNullable<T>);
  }
  return fallback ? fallback() : null;
}

// ============================================================================
// 6. Headless programmatic boundaries (`<Loading>` / `<Errored>`)
// ============================================================================

/**
 * Headless `<Loading>` boundary: delegates directly to native `createLoadingBoundary`.
 * Accepts either programmatic positional arguments `(fn, fallback, options)` or
 * the `{ fallback, children, on }` object shape.
 */
export function createLoadingBoundary<R>(
  fnOrOptions: (() => R) | { fallback: () => R; children: () => R; on?: () => unknown },
  fallback?: () => R,
  options?: { on?: () => unknown }
): NativeAccessor<R> {
  if (typeof fnOrOptions === "object" && fnOrOptions !== null) {
    return nativeCreateLoadingBoundary(
      fnOrOptions.children,
      fnOrOptions.fallback,
      fnOrOptions.on ? { on: fnOrOptions.on } : undefined
    ) as NativeAccessor<R>;
  }
  return nativeCreateLoadingBoundary(
    fnOrOptions,
    fallback ?? (() => null as unknown as R),
    options
  ) as NativeAccessor<R>;
}

/**
 * Headless self-healing `<Errored>` boundary: delegates directly to native
 * `createErrorBoundary`. Catches errors thrown by children, renders
 * `fallback(errorAccessor, reset)`, and automatically recovers when upstream
 * dependencies change.
 */
export function createErroredBoundary<R>(
  fnOrOptions:
    | (() => R)
    | { fallback: (error: NativeAccessor<unknown>, reset: () => void) => R; children: () => R },
  fallback?: (error: NativeAccessor<unknown>, reset: () => void) => R
): NativeAccessor<R> {
  if (typeof fnOrOptions === "object" && fnOrOptions !== null) {
    return nativeCreateErrorBoundary(
      fnOrOptions.children,
      fnOrOptions.fallback
    ) as NativeAccessor<R>;
  }
  return nativeCreateErrorBoundary(
    fnOrOptions,
    fallback ?? (() => null as unknown as R)
  ) as NativeAccessor<R>;
}

// ============================================================================
// 7. Server-functions test harness (headless; interoperates with native envelopes)
// ============================================================================

export interface RequestEvent {
  request: Request;
  locals: Record<string, unknown>;
}

let activeRequestEvent: RequestEvent | null = null;

export function provideRequestEvent<T>(event: RequestEvent, fn: () => T): T {
  const prev = activeRequestEvent;
  activeRequestEvent = event;
  try {
    return fn();
  } finally {
    activeRequestEvent = prev;
  }
}

export function getRequestEvent(): RequestEvent {
  if (!activeRequestEvent) {
    throw new Error("getRequestEvent() called outside an active server request context");
  }
  return activeRequestEvent;
}

const SERVER_FN_BRAND = Symbol.for("solid.server.function");

export interface ServerFunctionReference<Args extends any[], R> {
  (...args: Args): Promise<R>;
  readonly [SERVER_FN_BRAND]: true;
  readonly id: string;
  readonly url: string;
  readonly method: "POST" | "GET";
  readonly meta: Record<string, unknown>;
}

const serverFunctionRegistry = new Map<
  string,
  {
    fn: (...args: any[]) => any;
    method: "POST" | "GET";
    meta: Record<string, unknown>;
  }
>();

let serverEndpoint = "/_server";

export function configureServerFunctionsServer(options: { endpoint?: string }): void {
  if (options.endpoint) {
    serverEndpoint = options.endpoint;
  }
}

export function registerServerFunction<Args extends any[], R>(
  id: string,
  fn: (...args: Args) => Promise<R> | R,
  options?: { method?: "POST" | "GET"; meta?: Record<string, unknown> }
): ServerFunctionReference<Args, R> {
  const method = options?.method ?? "POST";
  const meta = { ...(options?.meta ?? {}) };
  serverFunctionRegistry.set(id, { fn, method, meta });

  const ref = (async (...args: Args): Promise<R> => {
    const raw = await fn(...args);
    if (nativeIsResponseEnvelope(raw)) {
      return raw.value as R;
    }
    return raw;
  }) as ServerFunctionReference<Args, R>;

  Object.defineProperties(ref, {
    [SERVER_FN_BRAND]: { value: true },
    id: { value: id },
    url: { value: `${serverEndpoint}/data/${id}` },
    method: { value: method, writable: true },
    meta: { value: meta, writable: true },
  });

  return ref;
}

export function isServerFunction(fn: unknown): fn is ServerFunctionReference<any[], any> {
  return typeof fn === "function" && (fn as any)[SERVER_FN_BRAND] === true;
}

export function getServerFunctionMetadata(
  fn: ServerFunctionReference<any[], any>
): Record<string, unknown> {
  return fn.meta;
}

export function GET<Args extends any[], R>(
  fn: ServerFunctionReference<Args, R>
): ServerFunctionReference<Args, R> {
  (fn as any).method = "GET";
  const entry = serverFunctionRegistry.get(fn.id);
  if (entry) entry.method = "GET";
  return fn;
}

export function withMeta<Args extends any[], R>(
  fn: ServerFunctionReference<Args, R>,
  metadata: Record<string, unknown>
): ServerFunctionReference<Args, R> {
  const merged = { ...fn.meta, ...metadata };
  (fn as any).meta = merged;
  const entry = serverFunctionRegistry.get(fn.id);
  if (entry) entry.meta = merged;
  return fn;
}

export interface InvokeOptions {
  signal?: AbortSignal;
  keepalive?: boolean;
  priority?: "high" | "low" | "auto";
}

export async function invoke<Args extends any[], R>(
  fn: ServerFunctionReference<Args, R>,
  options: InvokeOptions,
  ...args: Args
): Promise<R> {
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new Error("Aborted");
  }
  return await fn(...args);
}

export async function handleServerFunctionRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const prefix = `${serverEndpoint}/data/`;
  if (!url.pathname.startsWith(prefix)) {
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
  }
  const id = url.pathname.slice(prefix.length);
  const entry = serverFunctionRegistry.get(id);
  if (!entry) {
    return new Response(JSON.stringify({ error: `Unknown server function: ${id}` }), {
      status: 404,
    });
  }
  if (request.method === "GET" && entry.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
    });
  }

  let args: unknown[] = [];
  if (request.method === "GET") {
    const rawArgs = url.searchParams.get("args");
    args = rawArgs ? JSON.parse(rawArgs) : [];
  } else {
    const bodyText = await request.text();
    args = bodyText ? JSON.parse(bodyText) : [];
  }

  return await provideRequestEvent({ request, locals: {} }, async () => {
    try {
      const result = await entry.fn(...args);
      // Native response envelopes (which are Responses) unwrap to { data } first.
      if (nativeIsResponseEnvelope(result)) {
        const headers = new Headers(result.headers);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ data: result.value }), {
          status: result.status,
          headers,
        });
      }
      if (result instanceof Response) {
        return result;
      }
      return new Response(JSON.stringify({ data: result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      if (err instanceof Response) {
        return err;
      }
      if (nativeIsResponseEnvelope(err)) {
        const headers = new Headers(err.headers);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: err.value }), {
          status: err.status,
          headers,
        });
      }
      const message = nativeIsSafeError(err) && err instanceof Error
        ? err.message
        : "Internal Server Error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
