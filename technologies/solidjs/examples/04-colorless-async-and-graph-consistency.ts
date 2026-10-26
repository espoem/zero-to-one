/**
 * Module 04 — Colorless Async and Graph Consistency (SolidJS 2.x).
 *
 * Runnable verification suite. Run with:
 *   node examples/04-colorless-async-and-graph-consistency.ts
 *
 * Covers: native async derivations (`Promise<T>` and `AsyncIterable<T>` streams
 * inside `createMemo`/`createProjection`, no `createResource`), the
 * non-nullable `Accessor<T>` contract, synchronous `onCleanup` registration
 * before the first await/yield (AbortController cancellation), fetch-high /
 * block-low `NotReadyError` flow, `<Loading>` readiness boundaries (default
 * stale-keeping vs `on`-keyed reset), `isPending` / `latest` / `loadingValue` /
 * `seedLoadingValue` / `await resolve()` (no `startTransition`), self-healing
 * `<Errored>` boundaries with `(errorAccessor, reset)` fallback, and awaitable
 * `refresh`.
 */
import {
  createErroredBoundary,
  createLoadingBoundary,
  createMemo,
  createProjection,
  createSignal,
  createStore,
  flush,
  isPending,
  latest,
  NotReadyError,
  onCleanup,
  refresh,
  resolve,
} from "./utils/solid2-runtime.ts";
import { assert, assertEqual } from "./utils/type-helpers.ts";

let passed = 0;
function check(condition: boolean, message: string): void {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
} {
  let resolveFn: (value: T) => void = () => {};
  let rejectFn: (err: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return {
    promise,
    resolve: (value: T): void => {
      resolveFn(value);
    },
    reject: (err: unknown): void => {
      rejectFn(err);
    },
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((done) => {
    setTimeout(done, ms);
  });
}

async function settle(ms = 0): Promise<void> {
  await sleep(ms);
  flush();
}

type User = { id: string; name: string };

async function main(): Promise<void> {
  // --- 1. Native async derivations: Promise<T> without createResource ---------
  // The memo returns an accessor of the *resolved* value, typed as a
  // non-nullable `Accessor<User>` — consumers never branch on `T | undefined`.
  const gate1 = deferred<User>();
  const [userId, setUserId] = createSignal("u1");
  const fetches = new Map<string, Promise<User>>([["u1", gate1.promise]]);
  const user = createMemo((): Promise<User> => fetches.get(userId()) as Promise<User>);

  // Fetch high, block low: derived accessors throw the same NotReadyError, so
  // one boundary above them covers the whole branch with a single mount.
  const greeting = createMemo((): string => `hi ${user().name}`);

  let userNotReady = false;
  try {
    user();
  } catch (err) {
    userNotReady = err instanceof NotReadyError;
  }
  check(userNotReady, "reading an unresolved async memo throws NotReadyError");
  let greetingNotReady = false;
  try {
    greeting();
  } catch (err) {
    greetingNotReady = err instanceof NotReadyError;
  }
  check(greetingNotReady, "NotReadyError travels through downstream accessors");
  // Enclosing Loading boundary coordinates pending status and tree reveal
  createLoadingBoundary(() => {
    user();
    greeting();
  }, () => null);
  // Native contract: a read with no value yet is *loading*, not *pending* —
  // it follows the surrounding Loading path, and the probe only reports
  // updates to a value that already exists.
  check(!isPending(user), "unresolved memo without a value yet reports loading, not pending");

  gate1.resolve({ id: "u1", name: "Ada" });
  check((await resolve(user)).name === "Ada", "resolve() awaits the first settled value");
  // resolve() also drives unobserved downstream derivations to settle.
  check((await resolve(greeting)) === "hi Ada", "downstream derivation resolves with it");
  await settle();
  assertEqual(user().name, "Ada", "async memo commits the resolved value");
  assertEqual(greeting(), "hi Ada", "downstream derivation commits with it");
  check(!isPending(user), "settled memo is no longer pending");

  // --- 2. Background revalidation keeps stale UI stable ------------------------
  const gate2 = deferred<User>();
  fetches.set("u2", gate2.promise);
  setUserId("u2");
  flush();
  check(isPending(user), "tracked input change pends until the new answer reveals");
  assertEqual(user().name, "Ada", "stale value stays readable during revalidation");
  assertEqual(latest(user).name, "Ada", "latest() falls back to the stale value while in flight");
  gate2.resolve({ id: "u2", name: "Bea" });
  check((await resolve(user)).name === "Bea", "refetch resolves the new answer");
  check((await resolve(greeting)) === "hi Bea", "downstream derivation resolves the new answer");
  await settle();
  assertEqual(user().name, "Bea", "memo commits the new answer after revalidation");
  assertEqual(greeting(), "hi Bea", "derivations follow the new answer");

  // --- 3. AsyncIterable streams: async generators publish each yield ----------
  async function* priceTicks(): AsyncGenerator<number, void, void> {
    yield 100;
    yield 101;
    yield 102;
  }
  const price = createMemo(() => priceTicks());
  let streamNotReady = false;
  try {
    price();
  } catch (err) {
    streamNotReady = err instanceof NotReadyError;
  }
  check(streamNotReady, "stream memo is not ready before its first yield");
  createLoadingBoundary(() => price(), () => null);
  await resolve(price);
  for (let i = 0; i < 200 && price() !== 102; i += 1) await settle(1);
  flush();
  assertEqual(price(), 102, "async-generator memo publishes every yield, keeping the last");

  // --- 4. Cancel superseded work: onCleanup before the first await ------------
  // Cleanup must be registered synchronously in compute — after suspension the
  // owner context is gone, so late registration cannot stop anything.
  const [query, setQuery] = createSignal("a");
  const controllers: AbortController[] = [];
  let cleanupCount = 0;
  const search = createMemo(async (): Promise<string> => {
    const controller = new AbortController();
    controllers.push(controller);
    onCleanup(() => {
      cleanupCount += 1;
      controller.abort();
    });
    const current = query();
    await sleep(20);
    if (controller.signal.aborted) throw new Error("superseded");
    return `results:${current}`;
  });
  createLoadingBoundary(() => search(), () => null);
  flush();
  setQuery("b");
  flush();
  await settle(30);
  check((controllers[0] as AbortController).signal.aborted, "superseded fetch is aborted via synchronous onCleanup");
  check((controllers[1] as AbortController).signal.aborted === false, "replacement fetch keeps its own live signal");
  assertEqual(cleanupCount, 1, "exactly one cleanup ran for the superseded run");
  assertEqual(search(), "results:b", "superseded result is discarded, replacement commits");

  // --- 5. <Loading> readiness: mount once, reveal, then keep stale ------------
  const profileGate = deferred<string>();
  const profileSource = new Map<string, Promise<string>>([["n1", profileGate.promise]]);
  const [profileId, setProfileId] = createSignal("n1");
  const profile = createMemo((): Promise<string> => profileSource.get(profileId()) as Promise<string>);
  const view = createLoadingBoundary({
    fallback: () => "spinner",
    children: () => `profile:${profile()}`,
  });
  assertEqual(view(), "spinner", "Loading shows fallback for the initially unready branch");
  profileGate.resolve("Ada");
  check((await resolve(profile)) === "Ada", "profile source settles");
  flush();
  assertEqual(view(), "profile:Ada", "Loading reveals content once ready");

  const profileGate2 = deferred<string>();
  profileSource.set("n2", profileGate2.promise);
  setProfileId("n2");
  flush();
  check(isPending(profile), "background refetch pends while stale UI stays mounted");
  assertEqual(view(), "profile:Ada", "revealed Loading keeps stale content during revalidation");
  assertEqual(profile(), "Ada", "stale source value stays readable without throwing");
  profileGate2.resolve("Bea");
  await resolve(profile);
  flush();
  assertEqual(view(), "profile:Bea", "Loading swaps to the new answer once revealed");
  check(!isPending(profile), "pending clears after the new answer reveals");

  // --- 6. <Loading on={key}> re-arms fallback when the key changes ------------
  const tabGate = deferred<string>();
  const tabData = createMemo((): Promise<string> => tabGate.promise);
  const [tab, setTab] = createSignal<"t1" | "t2">("t1");
  const tabView = createLoadingBoundary({
    fallback: () => "loading-tab",
    children: () => (tab() === "t1" ? "ready-t1" : tabData()),
    on: () => tab(),
  });
  assertEqual(tabView(), "ready-t1", "keyed Loading reveals the first tab");
  setTab("t2");
  flush();
  assertEqual(tabView(), "loading-tab", "changed on-key re-shows fallback for the pending tab");
  tabGate.resolve("ready-t2");
  await resolve(tabData);
  flush();
  assertEqual(tabView(), "ready-t2", "keyed Loading reveals the new tab once ready");

  // --- 7. Provisional first paint: loadingValue & seedLoadingValue -------------
  // A loading value commits immediately: no suspension, no boundary hole, no
  // pending flag, and it becomes the initial `prev` for the compute.
  const levelGate = deferred<number>();
  const level = createMemo((): Promise<number> => levelGate.promise, { loadingValue: -1 });
  createLoadingBoundary(() => level(), () => null);
  assertEqual(level(), -1, "loadingValue is readable synchronously before resolution");
  check(!isPending(level), "loadingValue commits immediately with no pending flag");
  levelGate.resolve(41);
  await levelGate.promise;
  await settle(10);
  check((await resolve(level)) === 41, "loadingValue gives way to the first real answer");
  flush();
  assertEqual(level(), 41, "memo commits the real answer after first paint");
  check(!isPending(level), "pending clears once the first real answer commits");

  const todoGate = deferred<string[]>();
  const [todos] = createStore(
    (): Promise<string[]> => todoGate.promise,
    [] as string[],
    { seedLoadingValue: true },
  );
  check(todos.length === 0, "seed stays visible before first resolution (seedLoadingValue)");
  todoGate.resolve(["a", "b"]);
  await settle(0);
  check(todos.length === 2 && todos[0] === "a", "async derived store reconciles the resolved rows");

  // --- 8. resolve() keeps falsy values; refresh() re-asks ----------------------
  const zero = createMemo(async (): Promise<number> => 0);
  check((await resolve(zero)) === 0, "resolve delivers falsy first values, including 0");
  let polls = 0;
  const counter = createMemo(async (): Promise<number> => {
    polls += 1;
    return polls;
  });
  createLoadingBoundary(() => counter(), () => null);
  check((await resolve(counter)) === 1, "first resolve settles the initial answer");
  // Bare refresh is quiet for isPending; it simply re-asks and resolves next quiescence.
  check((await refresh(counter)) === 2, "refresh re-asks and resolves the next quiescent value");
  flush();
  assertEqual(counter(), 2, "refreshed value commits");
  check(!isPending(counter), "quiet refresh never sets pending");

  // --- 9. Async createProjection ------------------------------------------------
  const projGate = deferred<{ n: number }>();
  const projView = createProjection<{ n: number }>(
    (): Promise<{ n: number }> => projGate.promise,
    { n: 0 },
    { seedLoadingValue: true },
  );
  assertEqual(projView.n, 0, "async projection shows its seed before resolution");
  projGate.resolve({ n: 7 });
  await settle(0);
  assertEqual(projView.n, 7, "async projection reconciles the resolved value");

  // --- 10. Self-healing <Errored> -----------------------------------------------
  // The fallback receives the error as an accessor plus a reset action, and the
  // boundary heals by itself as soon as upstream signals recover — no reset call needed.
  const [shouldFail, setShouldFail] = createSignal(false);
  const risky = createMemo((): string => {
    if (shouldFail()) throw new Error("boom");
    return "steady";
  });
  let capturedReset: (() => void) | undefined;
  const guarded = createErroredBoundary({
    fallback: (err, reset) => {
      capturedReset = reset;
      return `fallback:${(err() as Error).message}`;
    },
    children: () => risky(),
  });
  assertEqual(guarded(), "steady", "healthy branch renders children");
  setShouldFail(true);
  flush();
  assertEqual(guarded(), "fallback:boom", "Errored catches the compute error with error() accessor");
  check(typeof capturedReset === "function", "Errored fallback receives a reset action");
  (capturedReset as () => void)();
  flush();
  assertEqual(guarded(), "fallback:boom", "manual reset re-runs while upstream still fails");
  setShouldFail(false);
  flush();
  assertEqual(guarded(), "steady", "boundary self-heals when upstream recovers, without reset");
  check(!isPending(risky), "healed source settles without pending");

  console.log(`\nAll ${passed} checks passed.`);
}

await main();
