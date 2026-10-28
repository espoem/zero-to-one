/**
 * Module 01 examples — Reactive core and signals (SolidJS 2.x).
 *
 * Runnable with: node examples/01-reactive-core-and-signals.ts
 * Covers: push-pull signals/memos (incl. lazy + writable derived),
 * deterministic microtask batching with flush(), split two-phase effects
 * (user vs render lane, error arm, defer), createReaction, ownership
 * (createRoot / runWithOwner / untrack / onCleanup / onSettled).
 */
import {
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
} from "./utils/solid2-runtime.ts";
import { assert, assertEqual, assertDeepEqual } from "./utils/type-helpers.ts";

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

// 1. Push-pull graph: memos recompute only when their own deps change.
check("signal + memo derive without re-running producers", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    let producerRuns = 0;
    const doubled = createMemo(() => {
      producerRuns += 1;
      return count() * 2;
    });
    assertEqual(doubled(), 0, "initial memo value");
    assertEqual(producerRuns, 1, "eager memo runs once at creation");
    const [unrelated, setUnrelated] = createSignal("a");
    const label = createMemo(() => unrelated());
    assertEqual(label(), "a", "unrelated memo");
    setCount(5);
    setUnrelated("b");
    flush();
    assertEqual(doubled(), 10, "memo reflects write after flush");
    assertEqual(label(), "b", "unrelated memo reflects write after flush");
    assertEqual(producerRuns, 2, "producer recomputed exactly once for one commit");
    dispose();
  });
});

// 2. Lazy memos evaluate on first read, not at creation.
check("lazy memo defers evaluation until first read", () => {
  createRoot((dispose) => {
    let runs = 0;
    const expensive = createMemo(
      () => {
        runs += 1;
        return 21 * 2;
      },
      { lazy: true, unobserved: () => {} },
    );
    assertEqual(runs, 0, "lazy memo has not run before first read");
    assertEqual(expensive(), 42, "first read evaluates");
    assertEqual(runs, 1, "evaluated exactly once");
    assertEqual(expensive(), 42, "second read reuses committed value");
    dispose();
  });
});

// 3. Writable derived signals follow their source but allow local override.
check("writable derived signal tracks source and accepts override", () => {
  createRoot((dispose) => {
    const [initial, setInitial] = createSignal("server");
    const [draft, setDraft] = createSignal(() => initial());
    assertEqual(draft(), "server", "derives initial value");
    setDraft("local edit");
    flush();
    assertEqual(draft(), "local edit", "local override wins");
    setInitial("server v2");
    flush();
    assertEqual(draft(), "server v2", "source change replaces override");
    setDraft((prev) => `${prev}!`);
    flush();
    assertEqual(draft(), "server v2!", "updater form composes");
    dispose();
  });
});

// 4. Deterministic microtask batching: stale read before flush, commit after.
check("writes queue on microtask; flush() commits synchronously", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    setCount(1);
    setCount(2);
    assertEqual(count(), 0, "read before flush is stale");
    flush();
    assertEqual(count(), 2, "writes coalesce to final value after flush");
    const returned = flush(() => {
      setCount(3);
      return "scope-result";
    });
    assertEqual(returned, "scope-result", "flush(fn) preserves return value");
    assertEqual(count(), 3, "flush(fn) drains before returning");
    dispose();
  });
});

// 5. Split effects: compute tracks, apply runs untracked with cleanup + prev.
check("split effect delivers (value, prev) and runs cleanup between applies", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    const seen: Array<{ value: number; prev: number | undefined }> = [];
    const cleanups: number[] = [];
    createEffect(
      () => count() * 10,
      (value, prev) => {
        seen.push({ value, prev });
        return () => {
          cleanups.push(value);
        };
      },
    );
    // Native effects apply on flush, not synchronously at creation.
    flush();
    assertEqual(seen.length, 1, "initial apply runs on first flush");
    assertEqual(seen[0]?.value, 0, "initial value");
    assert(seen[0]?.prev == null, "initial prev is nullish");
    setCount(1);
    flush();
    assertEqual(seen.length, 2, "second apply after commit");
    assertEqual(seen[1]?.value, 10, "second value");
    assertEqual(seen[1]?.prev, 0, "prev tracks prior computed value");
    assertDeepEqual(cleanups, [0], "cleanup ran before re-apply");
    dispose();
    assertDeepEqual(cleanups, [0, 10], "disposal runs latest cleanup");
  });
});

// 6. defer skips the initial apply; error arm handles compute failures.
check("defer skips initial apply; { effect, error } recovers", () => {
  createRoot((dispose) => {
    const [mode, setMode] = createSignal("ok");
    const applied: string[] = [];
    const errors: unknown[] = [];
    createEffect(
      () => {
        if (mode() === "boom") throw new Error("bad mode");
        return mode();
      },
      {
        effect: (value) => {
          applied.push(value);
        },
        error: (err) => {
          errors.push(err);
        },
      },
      { defer: true },
    );
    assertEqual(applied.length, 0, "deferred initial apply skipped");
    setMode("v2");
    flush();
    assertDeepEqual(applied, ["v2"], "apply runs on change");
    setMode("boom");
    flush();
    assertDeepEqual(applied, ["v2"], "failed compute does not apply");
    assertEqual(errors.length, 1, "error arm ran once");
    assert(errors[0] instanceof Error, "error identity preserved");
    setMode("v3");
    flush();
    assertDeepEqual(applied, ["v2", "v3"], "recovers without manual reset");
    dispose();
  });
});

// 7. Render lane runs before user lane inside one flush.
check("createRenderEffect drains before createEffect", () => {
  createRoot((dispose) => {
    const [tick, setTick] = createSignal(0);
    const order: string[] = [];
    createEffect(
      () => tick(),
      () => {
        order.push("user");
      },
    );
    order.length = 0; // ignore synchronous initial applies
    createRenderEffect(
      () => tick(),
      () => {
        order.push("render");
      },
    );
    order.length = 0;
    setTick(1);
    flush();
    assertDeepEqual(order, ["render", "user"], "render lane precedes user lane");
    dispose();
  });
});

// 8. createReaction fires once per arm, then disarms until re-tracked.
check("createReaction invalidates once and re-arms explicitly", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    let invalidations = 0;
    const track = createReaction(() => {
      invalidations += 1;
      track(() => count()); // re-arm for the next change
    });
    track(() => count());
    setCount(1);
    flush();
    assertEqual(invalidations, 1, "fires once on invalidation");
    setCount(2);
    flush();
    assertEqual(invalidations, 2, "re-armed tracking fires again");
    dispose();
  });
});

// 9. Ownership: untrack reads without subscribing; runWithOwner restores scope.
check("untrack isolates reads; runWithOwner restores owner", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    const owner = getOwner();
    assert(owner !== null, "root provides an owner");
    let effectRuns = 0;
    let sneaky = -1;
    createEffect(
      () => count(),
      () => {
        effectRuns += 1;
        sneaky = untrack(() => count());
      },
    );
    flush();
    assertEqual(effectRuns, 1, "split effect ran once on initial flush");
    // A write observed only through untrack must not retrigger the effect.
    runWithOwner(owner, () => {
      const probe = untrack(() => count());
      assertEqual(probe, 0, "untracked read sees committed value");
    });
    setCount(10);
    flush();
    assertEqual(sneaky, 10, "untracked read inside apply sees latest");
    assertEqual(effectRuns, 2, "effect ran once for the tracked change");
    dispose();
  });
});

// 10. Async-aware lifecycle: onSettled runs after flush with owned teardown.
check("onSettled runs post-flush; onCleanup disposes with owner", () => {
  const settled: string[] = [];
  const cleaned: string[] = [];
  createRoot((dispose) => {
    onCleanup(() => {
      cleaned.push("root-cleanup");
    });
    onSettled(() => {
      settled.push("settled");
      return () => {
        cleaned.push("settled-teardown");
      };
    });
    assertEqual(settled.length, 0, "settled callback waits for flush");
    flush();
    assertDeepEqual(settled, ["settled"], "settled ran during flush drain");
    dispose();
    assert(cleaned.includes("root-cleanup"), "root cleanup ran on dispose");
    assert(cleaned.includes("settled-teardown"), "settled teardown owned by root");
  });
});

// 11. Reactive Graph DAG & Glitch Freedom: The Diamond Problem
check("reactive DAG topological order guarantees glitch freedom in diamond dependency graph", () => {
  createRoot((dispose) => {
    // Diamond structure:
    //      A (source)
    //     / \
    //    B   C (memos)
    //     \ /
    //      D (derived memo: B + C)
    const [a, setA] = createSignal(1);
    let bRuns = 0;
    let cRuns = 0;
    let dRuns = 0;

    const b = createMemo(() => {
      bRuns += 1;
      return a() * 10;
    });

    const c = createMemo(() => {
      cRuns += 1;
      return a() + 5;
    });

    const d = createMemo(() => {
      dRuns += 1;
      return `${b()}-${c()}`;
    });

    // Initial read pulls all nodes
    assertEqual(d(), "10-6", "Initial evaluation of D resolves B and C");
    assertEqual(bRuns, 1);
    assertEqual(cRuns, 1);
    assertEqual(dRuns, 1);

    // Update source A
    setA(2);
    flush();

    // In a naive push-only graph without topological sorting, D would evaluate twice:
    // Once when B pushes (with B=20, stale C=6 -> glitch: "20-6"),
    // then again when C pushes (with B=20, C=7 -> "20-7").
    // SolidJS 2.0 push-pull guarantees topological resolution: D evaluates exactly ONCE with synchronized inputs.
    assertEqual(d(), "20-7", "D resolved both updated inputs without intermediate glitch state");
    assertEqual(bRuns, 2, "B recomputed exactly once");
    assertEqual(cRuns, 2, "C recomputed exactly once");
    assertEqual(dRuns, 2, "Glitch freedom: D recomputed exactly once for the single source change");

    dispose();
  });
});

console.log(`\nAll ${passed} Module 01 example suites passed.`);
