/**
 * Module 07: Migration from Solid 1.x to Solid 2.0 & Architectural Deep Dives
 * Runnable Verification & Comparative Test Suite
 *
 * Covers:
 * 1. Side-by-Side 1.x vs 2.0 API Verifications:
 *    - Microtask batching and explicit synchronous flush()
 *    - Split two-phase createEffect(compute, apply) & writable derived createSignal(fn)
 *    - Settled lifecycle (onSettled replacing onMount)
 *    - Providerless Context & ContextNotFoundError
 *    - Props utilities (merge, omit) & Store traversal (snapshot, deep)
 *    - Ref directive factories & Unified class binding
 *    - Unified <For> (keyed=true, keyed=false, custom key) & <Repeat>
 *    - Colorless async createMemo, latest(), isPending(), <Loading>, and self-healing <Errored>
 * 2. Deep Dive 1: O(1) Selection Projection & Normalized State
 *    - createProjection replacing createSelector with zero unselected re-evaluations
 * 3. Deep Dive 2: Transactional Actions & Resilient Real-Time Sync
 *    - Generator action(function* () {}) with createOptimisticStore
 *    - Out-of-order network responses, rollback on error, and WebSocket until() acknowledgments
 */

import {
  createSignal,
  createMemo,
  createEffect,
  createRenderEffect,
  createRoot,
  flush,
  untrack,
  onCleanup,
  onSettled,
  createContext,
  useContext,
  ContextNotFoundError,
  merge,
  omit,
  createStore,
  createProjection,
  storePath,
  snapshot,
  deep,
  resolveClass,
  applyRef,
  renderFor,
  renderRepeat,
  createLoadingBoundary,
  createErroredBoundary,
  createOptimisticStore,
  createOptimistic,
  action,
  refresh,
  affects,
  until,
  isPending,
  latest,
} from "./utils/solid2-runtime.ts";

import {
  assert,
  assertEqual,
  assertDeepEqual,
  assertThrowsAsync,
  type Expect,
  type Equal,
} from "./utils/type-helpers.ts";

declare const process: any;

// ============================================================================
// Section 1: Side-by-Side API Migration Tests
// ============================================================================

async function testBatchingAndFlush() {
  console.log("  [1.1] Testing Microtask Batching & flush()...");

  // In Solid 1.x: batch(() => { setCount(1); setName("Ada"); }) was required.
  // In Solid 2.0: Writes are automatically batched into a microtask queue.
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal("Initial");

  setCount(10);
  setName("Updated");

  // Before flush: signals hold uncommitted state in the current synchronous execution turn
  assertEqual(count(), 0, "count() remains 0 before microtask flush");
  assertEqual(name(), "Initial", "name() remains Initial before microtask flush");

  // flush() synchronously executes all pending writes and effect lanes
  flush();

  assertEqual(count(), 10, "count() is 10 after flush()");
  assertEqual(name(), "Updated", "name() is Updated after flush()");
}

async function testSplitTwoPhaseEffect() {
  console.log("  [1.2] Testing Split Two-Phase createEffect(compute, apply)...");

  // In Solid 1.x: createEffect(() => { console.log(count()); }) tracked everything in one body.
  // In Solid 2.0: createEffect(compute, apply) splits synchronous dependency tracking (compute)
  // from untracked side-effect execution (apply).
  let effectInvocations = 0;
  let cleanupsRun = 0;
  let lastAppliedValue = 0;
  let lastPrevValue: number | undefined = undefined;

  const [count, setCount] = createSignal(1);
  const [untrackedSignal, setUntrackedSignal] = createSignal("noise");

  createRoot((dispose) => {
    createEffect(
      // Phase 1: Pure compute (tracked)
      () => count() * 2,
      // Phase 2: Apply (untracked side effects)
      (value, prev) => {
        effectInvocations++;
        lastAppliedValue = value;
        lastPrevValue = prev;
        // Reading untrackedSignal here does NOT create a subscription!
        const _ignored = untrackedSignal();
        return () => {
          cleanupsRun++;
        };
      }
    );

    flush();
    assertEqual(effectInvocations, 1, "Initial effect execution");
    assertEqual(lastAppliedValue, 2, "First run value 1*2=2");
    assertEqual(lastPrevValue, undefined, "First run prev is undefined");

    // Updating count triggers compute and schedules apply
    setCount(2);
    flush();
    assertEqual(effectInvocations, 2, "Second effect execution");
    assertEqual(lastAppliedValue, 4, "Second run value 2*2=4");
    assertEqual(lastPrevValue, 2, "Second run prev is 2");
    assertEqual(cleanupsRun, 1, "Prior effect cleanup ran before next apply");

    // Updating untrackedSignal does NOT trigger the effect!
    setUntrackedSignal("changed");
    flush();
    assertEqual(effectInvocations, 2, "Untracked signal write did not trigger effect");

    // Root disposal triggers the active effect cleanup
    dispose();
    assertEqual(cleanupsRun, 2, "Root disposal ran remaining cleanup");
  });
}

async function testWritableDerivedSignal() {
  console.log("  [1.3] Testing Writable Derived createSignal(fn)...");

  // In Solid 1.x: Prop-derived writable state required createComputed write-backs.
  // In Solid 2.0: createSignal(fn) accepts a compute function, remaining reactive
  // to upstream sources while allowing direct manual setter overrides.
  createRoot(() => {
    const [multiplier, setMultiplier] = createSignal(2);
    const [derived, setDerived] = createSignal(() => multiplier() * 10);

    flush();
    assertEqual(derived(), 20, "Derived value initially 2 * 10 = 20");

    // Manually override the derived signal
    setDerived(999);
    flush();
    assertEqual(derived(), 999, "Manually overridden to 999");

    // Upstream dependency change re-evaluates the signal
    setMultiplier(3);
    flush();
    assertEqual(derived(), 30, "Upstream dependency change recalculates 3 * 10 = 30");
  });
}

async function testSettledLifecycle() {
  console.log("  [1.4] Testing onSettled Lifecycle Hook...");

  // In Solid 1.x: onMount executed synchronously during DOM mount.
  // In Solid 2.0: onSettled executes after the microtask batch and rendering lanes settle,
  // natively supporting returned cleanup functions.
  let settledRan = false;
  let settledCleanedUp = false;

  createRoot((dispose) => {
    onSettled(() => {
      settledRan = true;
      return () => {
        settledCleanedUp = true;
      };
    });

    assert(!settledRan, "onSettled has not run yet before microtask flush");
    flush();
    assert(settledRan, "onSettled ran after flush");
    assert(!settledCleanedUp, "Cleanup has not run yet");

    dispose();
    assert(settledCleanedUp, "Cleanup ran on root disposal");
  });
}

async function testProviderlessContext() {
  console.log("  [1.5] Testing Providerless Context & ContextNotFoundError...");

  // In Solid 1.x: createContext(defaultVal) with <Context.Provider value={...}>.
  // In Solid 2.0: Context is its own provider component (<ThemeContext value={...}>),
  // and reading a context without a default outside a provider throws ContextNotFoundError.
  interface UserSession {
    username: string;
    role: string;
  }

  const AuthContext = createContext<UserSession>(undefined, { name: "Auth" });

  // 1. Reading outside provider inside an owner throws ContextNotFoundError
  let errorCaught = false;
  createRoot(() => {
    try {
      useContext(AuthContext);
    } catch (err: any) {
      if (err instanceof ContextNotFoundError || err?.constructor?.name === "ContextNotFoundError") {
        errorCaught = true;
      }
    }
  });
  assert(errorCaught, "Reading default-less context without provider threw ContextNotFoundError");

  // 2. Reading inside provider works seamlessly without .Provider
  const sessionData: UserSession = { username: "ada", role: "admin" };
  const resultComp = (AuthContext as any)({
    value: sessionData,
    children: () => {
      const auth = useContext(AuthContext);
      return `${auth.username}:${auth.role}`;
    },
  });
  const result = typeof resultComp === "function" ? (resultComp as () => string)() : resultComp;

  assertEqual(result, "ada:admin", "Context value consumed inside provider");
}

async function testPropsUtilities() {
  console.log("  [1.6] Testing Props Helpers (merge, omit)...");

  // In Solid 1.x: mergeProps and splitProps.
  // In Solid 2.0:
  // - merge(...sources): Combines objects where undefined explicitly overrides.
  // - omit(source, ...keys): Returns rest object excluding specified keys.
  const defaults = { theme: "light", size: "md", disabled: false };
  const userProps = { size: "lg", disabled: undefined as any };

  const merged = merge(defaults, userProps);
  assertEqual(merged.theme, "light");
  assertEqual(merged.size, "lg");
  // In Solid 2.0 merge, undefined in an overriding object overrides earlier keys
  assertEqual(merged.disabled, undefined);

  const rest = omit(merged, "size");
  assertEqual((rest as any).theme, "light");
  assertEqual("size" in rest, false, "size was omitted from rest");
}

async function testStoreDraftsAndStorePath() {
  console.log("  [1.7] Testing Draft-First Stores, storePath, snapshot, and deep...");

  // In Solid 1.x: setStore("todos", id, "done", true) or produce(draft => ...)
  // In Solid 2.0: draft-first by default in setStore(draft => ...), with storePath for path migration.
  interface State {
    users: Array<{ id: number; name: string; active: boolean }>;
    metadata: { version: number };
  }

  const [store, setStore] = createStore<State>({
    users: [
      { id: 1, name: "Ada", active: true },
      { id: 2, name: "Grace", active: false },
    ],
    metadata: { version: 1 },
  });

  // 1. Draft-first mutation
  setStore((draft) => {
    draft.users[1]!.active = true;
    draft.metadata.version++;
  });
  flush();

  assertEqual(store.users[1]!.active, true, "Grace is now active via draft setter");
  assertEqual(store.metadata.version, 2, "Version incremented to 2");

  // 2. storePath helper for declarative path-based mutations
  setStore(storePath("users", (u: any) => u.id === 1, "name", "Ada Lovelace"));
  flush();
  assertEqual(store.users[0]!.name, "Ada Lovelace", "Ada updated via storePath");

  // 3. snapshot: untracked plain clone
  const plainSnapshot = snapshot(store);
  assertEqual(plainSnapshot.users[0]!.name, "Ada Lovelace");
  assert(plainSnapshot !== store, "snapshot is a distinct object");

  // 4. deep traversal: tracks entire nested store
  let deepRuns = 0;
  createRoot(() => {
    createEffect(
      () => deep(store),
      () => {
        deepRuns++;
      }
    );
    flush();
    assertEqual(deepRuns, 1, "Initial deep effect run");

    setStore((draft) => {
      draft.users[0]!.active = false;
    });
    flush();
    assertEqual(deepRuns, 2, "deep tracked nested active flag change");
  });
}

async function testUnifiedForAndRepeat() {
  console.log("  [1.8] Testing Unified <For> and <Repeat>...");

  const items = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ];

  // 1. Default keyed=true: raw item + index accessor
  const keyedOutput = renderFor(items, { keyed: true }, (item, index) => {
    return `${item.label}@${index()}`;
  });
  assertDeepEqual(keyedOutput, ["Alpha@0", "Beta@1"]);

  // 2. Positional keyed=false (replaces Solid 1.x <Index>): item accessor + index number
  const positionalOutput = renderFor(items, { keyed: false }, (item, index) => {
    return `${item().label}#${index}`;
  });
  assertDeepEqual(positionalOutput, ["Alpha#0", "Beta#1"]);

  // 3. <Repeat>: positional slot rendering without array diffing
  const repeated = renderRepeat({ count: 3, from: 1 }, (idx) => `Slot-${idx}`);
  assertDeepEqual(repeated, ["Slot-1", "Slot-2", "Slot-3"]);
}

async function testRefDirectivesAndClasses() {
  console.log("  [1.9] Testing Ref Directive Factories & Unified Class Binding...");

  // 1. Unified class binding: strings, arrays, objects
  const classOutput = resolveClass([
    "btn",
    { "btn-primary": true, "btn-disabled": false },
    ["shadow-lg", "px-4"],
  ]);
  assertEqual(classOutput, "btn btn-primary shadow-lg px-4");

  // 2. Ref Directive Factories: composable callback refs with cleanup
  createRoot((dispose) => {
    let boundElement: string | null = null;
    let directiveCleanedUp = false;

    const autoFocusDirective = (el: string) => {
      boundElement = el;
      onCleanup(() => {
        directiveCleanedUp = true;
      });
    };

    applyRef(autoFocusDirective as any, "mock-input-element" as any);
    assertEqual(boundElement, "mock-input-element");
    assert(!directiveCleanedUp);

    dispose();
    assert(directiveCleanedUp, "Ref directive cleanup invoked successfully upon disposal");
  });
}

async function testColorlessAsyncAndBoundaries() {
  console.log("  [1.10] Testing Colorless Async createMemo, <Loading>, and Self-Healing <Errored>...");

  // 1. Colorless async createMemo with Promise
  const [userId, setUserId] = createSignal(1);
  const userMemo = createMemo(async () => {
    const id = userId();
    await new Promise((r) => setTimeout(r, 10));
    return { id, name: `User_${id}` };
  });

  // Boundary catches initial unready state
  const boundary = createLoadingBoundary({
    fallback: () => "Loading user...",
    children: () => `Ready: ${userMemo().name}`,
  });

  assertEqual(boundary(), "Loading user...", "Initial state caught by Loading boundary");
  assertEqual(isPending(userMemo), false, "Initial unready state reports loading, not pending");

  // Wait for initial resolution
  await new Promise((r) => setTimeout(r, 20));
  flush();

  assertEqual(boundary(), "Ready: User_1", "Rendered user content once ready");
  assertEqual(isPending(userMemo), false, "userMemo no longer pending");
  assertEqual(latest(userMemo).name, "User_1", "latest() returns resolved value");

  // 2. Self-Healing <Errored> boundary
  const [dividend, setDividend] = createSignal(10);
  const [divisor, setDivisor] = createSignal(2);

  const divisionMemo = createMemo(() => {
    if (divisor() === 0) {
      throw new Error("DivisionByZero");
    }
    return dividend() / divisor();
  });

  const errorBoundary = createErroredBoundary({
    fallback: (err) => `Error caught: ${(err() as Error).message}`,
    children: () => `Result: ${divisionMemo()}`,
  });

  flush();
  assertEqual(errorBoundary(), "Result: 5");

  // Cause division by zero
  setDivisor(0);
  flush();
  assertEqual(errorBoundary(), "Error caught: DivisionByZero", "Caught error in boundary");

  // Self-heal: update divisor to non-zero; boundary recovers automatically without manual reset!
  setDivisor(5);
  flush();
  assertEqual(errorBoundary(), "Result: 2", "Self-healed back to normal rendering!");
}

// ============================================================================
// Section 2: Deep Dive 1 — O(1) Selection Projection & Normalized State
// ============================================================================

async function testDeepDive1SelectionProjection() {
  console.log("  [2.1] Deep Dive 1: O(1) Selection Projection vs O(N) createSelector...");

  /**
   * Architectural Context:
   * In Solid 1.x, `createSelector(selectedId)` created a specialized signal-based comparator.
   * In Solid 2.0, `createProjection` provides a generalized, draft-first reactive store
   * that computes fine-grained derived state.
   *
   * By storing selections as keyed records (`selected["row:1"] = true`), changing the
   * selection from Row A to Row B ONLY mutates `draft["row:A"]` (deleted) and `draft["row:B"]` (added).
   *
   * Crucially, the fine-grained proxy notifications touch ONLY the properties `row:A` and `row:B`.
   * For a list of N rows, exactly 2 row computations are notified — O(1) update complexity!
   */

  const NUM_ROWS = 100;
  const rows = Array.from({ length: NUM_ROWS }, (_, i) => ({
    id: i + 1,
    title: `Document ${i + 1}`,
  }));

  const [selectedId, setSelectedId] = createSignal<number>(10);

  // createProjection maintaining an active selection marker map
  const selectedProjection = createProjection<Record<string, boolean>>((draft) => {
    // Clear previously selected key(s)
    for (const key of Object.keys(draft)) {
      delete draft[key];
    }
    const current = selectedId();
    if (current !== undefined) {
      draft[`row:${current}`] = true;
    }
  }, {});

  flush();

  // Track subscription counts per row
  const rowRenderCounts = new Map<number, number>();
  for (let i = 1; i <= NUM_ROWS; i++) {
    rowRenderCounts.set(i, 0);
  }

  // Set up fine-grained subscribers for each row
  createRoot(() => {
    for (const row of rows) {
      createEffect(
        () => selectedProjection[`row:${row.id}`] === true,
        (isSelected) => {
          rowRenderCounts.set(row.id, (rowRenderCounts.get(row.id) ?? 0) + 1);
        }
      );
    }

    flush();

    // Verify initial renders: each row effect ran once
    for (let i = 1; i <= NUM_ROWS; i++) {
      assertEqual(rowRenderCounts.get(i), 1, `Initial effect run for row ${i}`);
    }
    assertEqual(selectedProjection["row:10"], true, "Row 10 is initially selected");
    assertEqual(selectedProjection["row:20"], undefined, "Row 20 is not selected");

    // NOW: Change selectedId from 10 to 42.
    // In an O(N) system, all 100 row effects would re-evaluate.
    // In Solid 2.0 with createProjection, ONLY row 10 and row 42 receive proxy notifications!
    setSelectedId(42);
    flush();

    assertEqual(selectedProjection["row:10"], undefined, "Row 10 is deselected");
    assertEqual(selectedProjection["row:42"], true, "Row 42 is now selected");

    // Verify update counts:
    assertEqual(rowRenderCounts.get(10), 2, "Row 10 received deselect notification");
    assertEqual(rowRenderCounts.get(42), 2, "Row 42 received select notification");

    // Every other row (e.g., row 1, 5, 20, 99) did NOT re-run!
    for (let i = 1; i <= NUM_ROWS; i++) {
      if (i !== 10 && i !== 42) {
        assertEqual(
          rowRenderCounts.get(i),
          1,
          `Row ${i} was completely untouched (O(1) selection confirmed!)`
        );
      }
    }
  });

  console.log("    ✓ Confirmed: Selection switch in 100-item table notified exactly 2 subscribers (O(1)).");
}

async function testDeepDive1NormalizedStoreProjection() {
  console.log("  [2.2] Deep Dive 1: Normalized Store with Write-Through Derived Projection...");

  interface User {
    id: string;
    name: string;
  }
  interface Post {
    id: string;
    authorId: string;
    content: string;
  }
  interface NormalizedDatabase {
    users: Record<string, User>;
    posts: Record<string, Post>;
  }

  const [db, setDb] = createStore<NormalizedDatabase>({
    users: {
      u1: { id: "u1", name: "Ada Lovelace" },
      u2: { id: "u2", name: "Alan Turing" },
    },
    posts: {
      p1: { id: "p1", authorId: "u1", content: "Analytical Engine Note G" },
      p2: { id: "p2", authorId: "u2", content: "Computing Machinery and Intelligence" },
    },
  });

  // A derived projection producing a denormalized post feed view
  interface FeedItem {
    postId: string;
    content: string;
    authorName: string;
  }

  const feedProjection = createProjection<Record<string, FeedItem>>((draft) => {
    for (const [postId, post] of Object.entries(db.posts)) {
      const author = db.users[post.authorId];
      draft[postId] = {
        postId,
        content: post.content,
        authorName: author ? author.name : "Anonymous",
      };
    }
  }, {});

  flush();

  assertEqual(feedProjection["p1"]!.authorName, "Ada Lovelace");
  assertEqual(feedProjection["p2"]!.authorName, "Alan Turing");

  // Mutating the normalized author in the source store automatically updates the projection!
  setDb((draft) => {
    draft.users["u1"]!.name = "Countess of Lovelace";
  });
  flush();

  assertEqual(feedProjection["p1"]!.authorName, "Countess of Lovelace", "Projection updated via normalized source edit");
}

// ============================================================================
// Section 3: Deep Dive 2 — Transactional Actions & Resilient Real-Time Sync
// ============================================================================

async function testDeepDive2ActionAndOptimisticStore() {
  console.log("  [3.1] Deep Dive 2: Concurrent Generator action & Optimistic Rollback...");

  /**
   * Architectural Context:
   * Solid 2.0's `action(function* () {})` turns generators into transactional mutations.
   * Each `yield` marks a re-entry checkpoint where optimistic writes take effect.
   * If an error occurs or the server rejects, `createOptimisticStore` automatically
   * rolls back all active mutations back to authoritative confirmed state.
   */

  interface Message {
    id: string;
    text: string;
    status: "pending" | "confirmed";
  }

  // Simulated server database
  let serverDatabase: Message[] = [
    { id: "m1", text: "Hello World", status: "confirmed" },
  ];

  const fakeApi = {
    async sendMessage(msg: Message, shouldFail: boolean = false): Promise<Message> {
      await new Promise((r) => setTimeout(r, 15));
      if (shouldFail) {
        throw new Error("NetworkError: 500 Internal Server Error");
      }
      const confirmedMsg: Message = { ...msg, status: "confirmed" };
      serverDatabase.push(confirmedMsg);
      return confirmedMsg;
    },
  };

  const [chatStore, setChatStore] = createOptimisticStore<Message[]>(
    () => [...serverDatabase],
    []
  );

  flush();
  assertEqual(chatStore.length, 1);
  assertEqual(chatStore[0]!.text, "Hello World");

  // Generator Action: Optimistically updates chatStore, yields API call, revalidates
  const sendAction = action(function* (text: string, shouldFail: boolean = false) {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticItem: Message = { id: tempId, text, status: "pending" };

    // 1. Optimistic write: immediately visible in UI
    setChatStore((draft) => {
      draft.push(optimisticItem);
    });

    // 2. Yield to perform server API call
    const confirmed: Message = yield fakeApi.sendMessage(optimisticItem, shouldFail);

    // 3. Reconcile with authoritative store via refresh
    yield refresh(chatStore);
    return confirmed;
  });

  // A. Successful Optimistic Mutation
  const promiseA = sendAction("First Optimistic Message", false);
  flush();

  // Instantly visible optimistically before network resolves!
  assertEqual(chatStore.length, 2, "Optimistic item immediately present");
  assertEqual(chatStore[1]!.text, "First Optimistic Message");
  assertEqual(chatStore[1]!.status, "pending", "Status is pending during flight");

  await promiseA;
  flush();

  assertEqual(chatStore.length, 2, "Authoritative message confirmed");
  assertEqual(chatStore[1]!.status, "confirmed", "Status confirmed after resolution");

  // B. Failed Optimistic Mutation (Automatic Rollback)
  let caughtError: unknown = null;
  const promiseB = sendAction("Doomed Message That Fails", true).catch((err) => {
    caughtError = err;
  });

  flush();
  assertEqual(chatStore.length, 3, "Failed item temporarily visible optimistically");
  assertEqual(chatStore[2]!.text, "Doomed Message That Fails");

  await promiseB;
  flush();

  assert(caughtError !== null, "Action threw on server error");
  assertEqual(chatStore.length, 2, "Optimistic store rolled back to 2 confirmed items!");
  assertEqual(chatStore.some((m) => m.text === "Doomed Message That Fails"), false, "Failed message purged");
}

async function testDeepDive2OutOfOrderResponses() {
  console.log("  [3.2] Deep Dive 2: Handling Out-of-Order Concurrent Mutations...");

  interface Item {
    id: string;
    val: string;
  }

  let serverItems: Item[] = [];

  const [itemsStore, setItemsStore] = createOptimisticStore<Item[]>(
    () => [...serverItems],
    []
  );

  // Simulate slow network for Item 1 (40ms) and fast network for Item 2 (10ms)
  const pushItemAction = action(function* (id: string, val: string, delayMs: number) {
    setItemsStore((draft) => {
      draft.push({ id, val: `${val} (optimistic)` });
    });

    yield new Promise((r) => setTimeout(r, delayMs));
    serverItems.push({ id, val });
    yield refresh(itemsStore);
    return id;
  });

  // Fire mutation 1 (slow, 40ms) and mutation 2 (fast, 10ms) concurrently
  const slowP = pushItemAction("item_slow", "Slow Item", 40);
  const fastP = pushItemAction("item_fast", "Fast Item", 10);

  flush();
  assertEqual(itemsStore.length, 2, "Both optimistic items visible in order of dispatch");

  // Concurrent actions entangle their frames: the fast mutation holds its final commit
  // until the entire entangled transaction group settles, preventing out-of-order partial flashes.
  await Promise.all([slowP, fastP]);
  flush();
  assertEqual(itemsStore.length, 2, "Both items present and authoritative");
  assert(itemsStore.some((i) => i.id === "item_fast"), "Fast item committed");
  assert(itemsStore.some((i) => i.id === "item_slow"), "Slow item committed");
}

async function testDeepDive2WebSocketUntilSynchronization() {
  console.log("  [3.3] Deep Dive 2: Real-Time WebSocket Acknowledgment via until()...");

  /**
   * Architectural Context:
   * In collaborative real-time architectures (e.g. Figma, Linear, Live Chat),
   * client mutations send a message over a WebSocket and wait for an authoritative
   * server ack or broadcast before settling the action.
   *
   * Solid 2.0's `until(predicate, { timeout, signal })` allows generator actions
   * to pause and await live state conditions without spinning or race conditions.
   */

  interface MessageState {
    id: string;
    confirmed: boolean;
  }

  const [wsAckMap, setWsAckMap] = createSignal<Record<string, boolean>>({});

  // Simulated WebSocket message handler
  const simulateWebSocketServerAck = (msgId: string, delayMs: number) => {
    setTimeout(() => {
      setWsAckMap((prev) => ({ ...prev, [msgId]: true }));
      flush();
    }, delayMs);
  };

  const syncMessageAction = action(function* (msgId: string) {
    // 1. Kick off simulated server WebSocket delivery
    simulateWebSocketServerAck(msgId, 25);

    // 2. Await until() the WebSocket ack is registered in our reactive graph!
    const ackReceived = yield until(
      () => wsAckMap()[msgId] === true,
      { timeout: 1000 }
    );

    return `Message ${msgId} acknowledged via WebSocket! (ack=${ackReceived})`;
  });

  const resultPromise = syncMessageAction("msg_999");
  flush();

  const result = await resultPromise;
  assertEqual(result, "Message msg_999 acknowledged via WebSocket! (ack=true)");
  console.log("    ✓ Confirmed: Action cleanly held transaction until live WebSocket ack arrived.");
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log("================================================================================");
  console.log("SolidJS 2.0 Verification Suite: Module 07 Side-by-Side & Deep Dives");
  console.log("================================================================================");

  const startTime = Date.now();

  try {
    console.log("\n▶ Running 1.x vs 2.0 Side-by-Side Verification Tests:");
    await testBatchingAndFlush();
    await testSplitTwoPhaseEffect();
    await testWritableDerivedSignal();
    await testSettledLifecycle();
    await testProviderlessContext();
    await testPropsUtilities();
    await testStoreDraftsAndStorePath();
    await testUnifiedForAndRepeat();
    await testRefDirectivesAndClasses();
    await testColorlessAsyncAndBoundaries();

    console.log("\n▶ Running Architectural Deep Dive 1 (O(1) Projections):");
    await testDeepDive1SelectionProjection();
    await testDeepDive1NormalizedStoreProjection();

    console.log("\n▶ Running Architectural Deep Dive 2 (Transactional Actions & Live Sync):");
    await testDeepDive2ActionAndOptimisticStore();
    await testDeepDive2OutOfOrderResponses();
    await testDeepDive2WebSocketUntilSynchronization();

    const duration = Date.now() - startTime;
    console.log("\n================================================================================");
    console.log(`✅ ALL 13 TEST SUITES PASSED CLEANLY (${duration}ms)`);
    console.log("================================================================================");
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
