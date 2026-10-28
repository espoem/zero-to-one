/**
 * Module 08: Server Actions & Optimistic UI
 *
 * Verifies React 19 `useActionState` state machines, speculative `useOptimistic`
 * updates with automatic rollback on error, and race-condition mitigation.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 08: Server Actions & Optimistic UI ===");

// 1. React 19 `useActionState` State Machine Simulation
type ActionFn<S, P> = (prevState: S, payload: P) => Promise<S>;

class ActionStateModel<S, P> {
  state: S;
  actionFn: ActionFn<S, P>;
  isPending: boolean = false;
  listeners: Array<() => void> = [];

  constructor(actionFn: ActionFn<S, P>, initialState: S) {
    this.actionFn = actionFn;
    this.state = initialState;
  }

  async dispatch(payload: P): Promise<S> {
    this.isPending = true;
    this.notify();
    try {
      this.state = await this.actionFn(this.state, payload);
      return this.state;
    } finally {
      this.isPending = false;
      this.notify();
    }
  }

  notify() {
    for (const cb of this.listeners) cb();
  }
}

{
  interface CounterState {
    value: number;
    lastError?: string;
  }

  const model = new ActionStateModel<CounterState, number>(async (prev, amount) => {
    // Simulate server action latency
    await new Promise((r) => setTimeout(r, 10));
    if (amount < 0) {
      return { value: prev.value, lastError: "Negative amounts disallowed" };
    }
    return { value: prev.value + amount };
  }, { value: 10 });

  assert.equal(model.state.value, 10);
  assert.equal(model.isPending, false);

  const dispatchPromise = model.dispatch(5);
  assert.equal(model.isPending, true, "isPending is true immediately upon action dispatch");

  const finalState = await dispatchPromise;
  assert.equal(finalState.value, 15);
  assert.equal(model.isPending, false, "isPending reverts to false upon action settlement");

  console.log("✓ useActionState transition lifecycle verified.");
}

// 2. React 19 `useOptimistic` Speculative Update & Mandatory Rollback
class OptimisticStateModel<T, A> {
  currentCommittedState: T;
  optimisticState: T;
  updateFn: (current: T, action: A) => T;
  pendingActions: A[] = [];

  constructor(committedState: T, updateFn: (current: T, action: A) => T) {
    this.currentCommittedState = committedState;
    this.optimisticState = committedState;
    this.updateFn = updateFn;
  }

  addOptimistic(action: A) {
    this.pendingActions.push(action);
    this.recompute();
  }

  commit(newCommittedState: T) {
    this.currentCommittedState = newCommittedState;
    this.pendingActions.shift();
    this.recompute();
  }

  rollback() {
    this.pendingActions.shift();
    this.recompute();
  }

  private recompute() {
    let next = this.currentCommittedState;
    for (const a of this.pendingActions) {
      next = this.updateFn(next, a);
    }
    this.optimisticState = next;
  }
}

{
  // Task list optimistic addition
  const model = new OptimisticStateModel<string[], string>(
    ["Task 1"],
    (tasks, newTask) => [...tasks, newTask]
  );

  assert.deepEqual(model.optimisticState, ["Task 1"]);

  // 1) User adds "Task 2": immediately visible in optimisticState
  model.addOptimistic("Task 2 (Optimistic)");
  assert.deepEqual(model.optimisticState, ["Task 1", "Task 2 (Optimistic)"]);
  assert.deepEqual(model.currentCommittedState, ["Task 1"], "Base state unchanged until server responds");

  // 2) Server succeeds: commit real task
  model.commit(["Task 1", "Task 2"]);
  assert.deepEqual(model.optimisticState, ["Task 1", "Task 2"]);
  assert.deepEqual(model.currentCommittedState, ["Task 1", "Task 2"]);

  // 3) User adds "Task 3", but server throws error -> Rollback!
  model.addOptimistic("Task 3 (Optimistic)");
  assert.deepEqual(model.optimisticState, ["Task 1", "Task 2", "Task 3 (Optimistic)"]);

  // Server rejection
  model.rollback();
  assert.deepEqual(
    model.optimisticState,
    ["Task 1", "Task 2"],
    "Optimistic update must roll back to exact committed state on action rejection"
  );

  console.log("✓ useOptimistic immediate UI mutation and rollback verified.");
}

// 3. Negative Proof: Action Race Condition & Lost Updates
{
  let serverValue = "Original";
  let requestCounter = 0;

  async function slowServerMutation(newValue: string, delayMs: number) {
    const requestId = ++requestCounter;
    await new Promise((r) => setTimeout(r, delayMs));
    serverValue = newValue;
    return { newValue, requestId };
  }

  // User submits update A (delay 50ms), then quickly submits update B (delay 10ms)
  const opA = slowServerMutation("Update A", 50);
  const opB = slowServerMutation("Update B", 10);

  await Promise.all([opA, opB]);

  // BUG: Update B finished first, but Update A finished last and overwrote serverValue with stale value!
  assert.equal(
    serverValue,
    "Update A",
    "Negative proof: Concurrent mutations without monotonicity/idempotency keys cause lost updates"
  );

  // Resolution with monotonic version tracking:
  let safeServerValue = "Original";
  let lastCommittedVersion = 0;

  async function safeMonotonicMutation(newValue: string, version: number, delayMs: number) {
    await new Promise((r) => setTimeout(r, delayMs));
    if (version > lastCommittedVersion) {
      safeServerValue = newValue;
      lastCommittedVersion = version;
    }
  }

  const safeOpA = safeMonotonicMutation("Update A", 1, 50);
  const safeOpB = safeMonotonicMutation("Update B", 2, 10);

  await Promise.all([safeOpA, safeOpB]);

  assert.equal(
    safeServerValue,
    "Update B",
    "Monotonic versioning correctly prevents older delayed mutation from overwriting newer update"
  );

  console.log("✓ Negative proof: Action race condition detected and resolved via monotonic ordering.");
}

console.log("All 08 Actions & Optimistic UI tests passed successfully!\n");
