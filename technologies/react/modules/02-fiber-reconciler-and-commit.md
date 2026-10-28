# 02: Fiber Reconciler & Tree Mutation

## 1. Academic Foundations: The Fiber Architecture

React Fiber is a complete rewrite of React's reconciliation engine designed to enable incremental, interruptible rendering and priority scheduling. Prior to Fiber, React used a recursive call stack ("Stack Reconciler") that could not yield execution to the browser once started, resulting in dropped frames during complex updates.

### 1.1 The Fiber Node Data Structure

A **Fiber** represents an individual unit of work. Fibers form a persistent, linked tree structure organized via three fundamental pointer references:
- `child`: Points to the first direct child node.
- `sibling`: Points to the immediate sibling node sharing the same parent.
- `return`: Points back to the parent fiber node (the target to which completed work returns).

```
         App Fiber
             | (child)
             v
       Header Fiber ----(sibling)----> Main Fiber
             |                             |
             v (return: App)               v (return: App)
```

This linked-list formulation transforms call-stack recursion into an iterative while-loop (`workLoopConcurrent`), allowing React to pause, check deadlines, yield to the browser event loop, and resume computation without losing traversal position.

### 1.2 Double Buffering & Two-Phase Execution

React Fiber employs **double buffering**, a classic graphics architecture pattern:
1. **Current Tree**: The committed fiber tree currently reflected on screen (`root.current`).
2. **WorkInProgress Tree**: The speculative, scratchpad fiber tree being actively computed in the background (`root.current.alternate`).

The reconciliation cycle is split into two distinct phases:

```
+-------------------------------------------------------------+
|                 Render Phase (Interruptible)                |
|  - beginWork(): Computes diffs, evaluates components        |
|  - completeWork(): Assembles mutation effect lists          |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 Commit Phase (Atomic, Uninterruptible)      |
|  - Swaps pointers: root.current = workInProgress            |
|  - Mutation: DOM inserts, updates, deletes                  |
|  - Layout effects & Passive effects executed                |
+-------------------------------------------------------------+
```

---

## 2. Multi-Tier Progression: Keyed List Reconciliation Mechanics

When an element returns an array of children, React must reconcile the old fiber linked list against the new element array.

### 2.1 The Two-Pass Reconciler Algorithm

1. **First Pass (Prefix Matching)**: Traverses both lists simultaneously from index 0. If keys match, fibers are reused in-place with updated props. Traversal stops at the first key mismatch.
2. **Second Pass (Map Lookup)**: Remaining existing fibers are placed into a keyed hash map (`Map<string | number, Fiber>`). React iterates over the remaining new elements and looks up each item by key in $O(1)$ time. Unmatched fibers are marked with the `Deletion` effect tag.

### 2.2 Stable Identity vs. Index Keys (Failure Mode)

Using array indices as keys (`key={index}`) breaks the reconciler's fundamental assumption that `key` represents domain identity:
- When an item is prepended or sorted, its array index changes.
- React matches slot 0 to old slot 0, preserving internal state (such as uncontrolled text inputs or local toggle state) on the wrong domain item.

---

## 3. Executable Proofs & Edge Cases

The accompanying test suite [02-fiber-reconciliation-and-keys.ts](../examples/02-fiber-reconciliation-and-keys.ts) provides deterministic verification:
- **Topology Verification**: Proves exact child, sibling, and return pointer assignments.
- **Double-Buffering Swap**: Demonstrates state isolation during render and atomic commit swap.
- **Negative Proof of Index Keys**: Shows how prepending an item with index keys corrupts child input state, whereas stable ID keys preserve state invariants.
