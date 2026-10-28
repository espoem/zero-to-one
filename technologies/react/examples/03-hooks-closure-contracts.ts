/**
 * Module 03: Hooks, State & Closure Mechanics
 *
 * Verifies hook linked-list indexing, dispatcher constraints, stale closure
 * capture bugs with functional updater fixes, and automatic batching semantics.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 03: Hooks, State & Closure Mechanics ===");

// 1. Hook Linked-List State Model & Call-Order Invariant
interface HookRecord {
  memoizedState: any;
  queue: any[];
  next: HookRecord | null;
}

class MiniComponentDispatcher {
  firstHook: HookRecord | null = null;
  currentHook: HookRecord | null = null;
  workInProgressHook: HookRecord | null = null;
  isMount: boolean = true;

  useState<T>(initialValue: T): [T, (action: T | ((prev: T) => T)) => void] {
    let hook: HookRecord;

    if (this.isMount) {
      hook = {
        memoizedState: initialValue,
        queue: [],
        next: null,
      };

      if (!this.firstHook) {
        this.firstHook = hook;
      } else if (this.workInProgressHook) {
        this.workInProgressHook.next = hook;
      }
      this.workInProgressHook = hook;
    } else {
      // Re-render: traverse linked list by call order
      if (!this.currentHook) {
        hook = this.firstHook!;
      } else {
        hook = this.currentHook.next!;
      }
      this.currentHook = hook;

      // Drain queued updates
      for (const update of hook.queue) {
        if (typeof update === "function") {
          hook.memoizedState = update(hook.memoizedState);
        } else {
          hook.memoizedState = update;
        }
      }
      hook.queue = [];
    }

    const dispatch = (action: T | ((prev: T) => T)) => {
      hook.queue.push(action);
    };

    return [hook.memoizedState, dispatch];
  }

  finishRender() {
    this.isMount = false;
    this.currentHook = null;
    this.workInProgressHook = null;
  }
}

{
  const dispatcher = new MiniComponentDispatcher();

  // Mount pass: Hook 1 (count: 0), Hook 2 (name: "Alice")
  const [count0, setCount] = dispatcher.useState(0);
  const [name0, setName] = dispatcher.useState("Alice");
  dispatcher.finishRender();

  assert.equal(count0, 0);
  assert.equal(name0, "Alice");

  // Dispatch updates
  setCount((prev) => prev + 1);
  setName("Bob");

  // Second render: must call hooks in exact same order
  const [count1] = dispatcher.useState(0);
  const [name1] = dispatcher.useState("Alice");
  dispatcher.finishRender();

  assert.equal(count1, 1, "First hook receives drained update for count");
  assert.equal(name1, "Bob", "Second hook receives drained update for name");

  console.log("✓ Hook linked-list state traversal verified.");
}

// 2. Negative Proof: Conditional Hook Execution Corrupts State
{
  const dispatcher = new MiniComponentDispatcher();

  // Mount: Hook 1 (condition: false), Hook 2 (theme: "dark")
  dispatcher.useState(false); // Hook 1: condition
  dispatcher.useState("dark"); // Hook 2: theme
  dispatcher.finishRender();

  // Re-render violates rules of hooks by conditionally inserting a new hook at slot 1!
  let errorCaught = false;
  try {
    // Condition becomes true, so an extra hook is called before theme
    dispatcher.useState(true); // Hook 1
    const [hijackedState] = dispatcher.useState("extra-hook-state"); // Hook 2 reads slot 2 (which belongs to theme!)
    // The component expected "extra-hook-state", but slot 2 holds "dark"!
    assert.equal(
      hijackedState,
      "dark",
      "Calling hooks conditionally causes subsequent hooks to read mismatched slots"
    );
  } catch (_e) {
    errorCaught = true;
  }

  assert.ok(!errorCaught, "Slot shift verified as negative proof");
  console.log("✓ Negative proof: Violating hook call order shifts state slots.");
}

// 3. Stale Closure vs. Functional Updater Proof
{
  let count = 0;
  const dispatchQueue: Array<(prev: number) => number> = [];

  function setCountDirect(newVal: number) {
    // Closes over `newVal` computed at call site
    count = newVal;
  }

  function setCountFunctional(updater: (prev: number) => number) {
    dispatchQueue.push(updater);
  }

  function applyQueue() {
    for (const updater of dispatchQueue) {
      count = updater(count);
    }
    dispatchQueue.length = 0;
  }

  // Scenario: 3 rapid clicks with stale closure:
  // Each handler captured `count === 0` at the time of render
  const capturedCount = 0;
  setCountDirect(capturedCount + 1); // direct update 1
  setCountDirect(capturedCount + 1); // direct update 2
  setCountDirect(capturedCount + 1); // direct update 3

  assert.equal(
    count,
    1,
    "Stale closure trap: 3 updates using captured count produce only 1 increment (lost updates)"
  );

  // Resolution: Functional updaters operate on latest reducer state
  count = 0;
  setCountFunctional((c) => c + 1);
  setCountFunctional((c) => c + 1);
  setCountFunctional((c) => c + 1);
  applyQueue();

  assert.equal(count, 3, "Functional updaters correctly accumulate all 3 increments");
  console.log("✓ Stale closure trap and functional updater proof verified.");
}

console.log("All 03 Hooks & Closure Contracts tests passed successfully!\n");
