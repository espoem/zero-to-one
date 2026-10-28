/**
 * Module 02: Fiber Reconciler & Tree Mutation
 *
 * Verifies the Fiber node data structure, parent-child-sibling pointer topology,
 * double-buffering pointer swap, and key stability vs. index-key corruption proofs.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 02: Fiber Reconciler & Tree Mutation ===");

// 1. Fiber Node Structure & Pointer Topology
interface FiberNode {
  tag: string;
  key: string | null;
  stateNode: any;
  child: FiberNode | null;
  sibling: FiberNode | null;
  return: FiberNode | null;
  alternate: FiberNode | null;
  memoizedState: any;
}

function createFiber(tag: string, key: string | null = null, stateNode: any = null): FiberNode {
  return {
    tag,
    key,
    stateNode,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
    memoizedState: null,
  };
}

{
  // Simulating an App fiber with two children: Header and Main
  const appFiber = createFiber("App");
  const headerFiber = createFiber("Header");
  const mainFiber = createFiber("Main");

  // Pointer wiring: App -> child: Header -> sibling: Main
  appFiber.child = headerFiber;
  headerFiber.sibling = mainFiber;
  headerFiber.return = appFiber;
  mainFiber.return = appFiber;

  assert.equal(appFiber.child, headerFiber, "Child pointer points to first child");
  assert.equal(headerFiber.sibling, mainFiber, "First child points to sibling");
  assert.equal(mainFiber.sibling, null, "Last sibling has null sibling pointer");
  assert.equal(headerFiber.return, appFiber, "Child return pointer points to parent");
  assert.equal(mainFiber.return, appFiber, "Sibling return pointer points to parent");

  console.log("✓ Fiber pointer topology (child/sibling/return) verified.");
}

// 2. Double-Buffering Mechanics (Current vs WorkInProgress)
{
  let currentRoot = createFiber("RootNode", null, { domId: "root" });
  currentRoot.memoizedState = { count: 0 };

  // Begin render pass: allocate or reuse alternate workInProgress
  let workInProgressRoot = createFiber("RootNode", null, currentRoot.stateNode);
  workInProgressRoot.alternate = currentRoot;
  currentRoot.alternate = workInProgressRoot;

  // Mutate speculative state in workInProgress
  workInProgressRoot.memoizedState = { count: 1 };

  // While rendering, currentRoot still holds committed state
  assert.equal(currentRoot.memoizedState.count, 0, "Current fiber tree retains committed state during render");
  assert.equal(workInProgressRoot.memoizedState.count, 1, "WorkInProgress fiber tree holds speculative state");

  // Commit Phase: Pointer swap
  currentRoot = workInProgressRoot;
  assert.equal(currentRoot.memoizedState.count, 1, "After commit phase pointer swap, new state is committed");

  console.log("✓ Double buffering pointer swap mechanics verified.");
}

// 3. Key Stability vs Index-Key Corruption (Negative Proof)
{
  interface Item {
    id: string;
    text: string;
  }

  // Model a reconciler resolving stateful child nodes
  class StatefulItemComponent {
    id: string;
    userInputValue: string;
    constructor(id: string, userInputValue: string) {
      this.id = id;
      this.userInputValue = userInputValue;
    }
  }

  // Initial list: Item A (typed "foo"), Item B (typed "bar")
  const initialData: Item[] = [
    { id: "id-a", text: "Item A" },
    { id: "id-b", text: "Item B" },
  ];

  // Map state using Stable Keys
  const stableInstances = new Map<string, StatefulItemComponent>();
  for (const item of initialData) {
    stableInstances.set(item.id, new StatefulItemComponent(item.id, item.id === "id-a" ? "input-A" : "input-B"));
  }

  // Prepend Item C to list: [Item C, Item A, Item B]
  const updatedData: Item[] = [
    { id: "id-c", text: "Item C" },
    { id: "id-a", text: "Item A" },
    { id: "id-b", text: "Item B" },
  ];

  // 1) Stable Key Reconciliation: Look up by item.id
  const reconciledStable = updatedData.map((item) => {
    return stableInstances.get(item.id) ?? new StatefulItemComponent(item.id, "empty");
  });

  // Verify stable keys correctly preserved state for Item A and B
  assert.equal(reconciledStable[0]?.id, "id-c");
  assert.equal(reconciledStable[0]?.userInputValue, "empty", "New item C receives fresh initial state");

  assert.equal(reconciledStable[1]?.id, "id-a");
  assert.equal(reconciledStable[1]?.userInputValue, "input-A", "Item A preserved its state across prepend");

  assert.equal(reconciledStable[2]?.id, "id-b");
  assert.equal(reconciledStable[2]?.userInputValue, "input-B", "Item B preserved its state across prepend");

  // 2) Index Key Reconciliation (Negative Proof / Anti-Pattern):
  // When keys are indices (0, 1, 2), slot 0 gets mapped to instance previously at slot 0 (Item A)!
  const indexInstances = [
    new StatefulItemComponent("id-a", "input-A"), // index 0
    new StatefulItemComponent("id-b", "input-B"), // index 1
  ];

  // Reconcile by index:
  const reconciledByIndex = updatedData.map((item, index) => {
    const existing = indexInstances[index];
    if (existing) {
      // Reused instance for wrong item!
      return { item, instance: existing };
    }
    return { item, instance: new StatefulItemComponent(item.id, "empty") };
  });

  // BUG: slot 0 is Item C, but holds input-A!
  assert.equal(reconciledByIndex[0]?.item.id, "id-c");
  assert.equal(
    reconciledByIndex[0]?.instance.userInputValue,
    "input-A",
    "Negative proof: Index keys corrupt state by assigning previous instance's state to unrelated item"
  );

  console.log("✓ Key reconciliation algorithm and index-key state corruption proof verified.");
}

console.log("All 02 Fiber Reconciler tests passed successfully!\n");
