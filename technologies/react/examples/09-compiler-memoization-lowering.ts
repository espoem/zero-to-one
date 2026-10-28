/**
 * Module 09: React Compiler & Memoization Lowering
 *
 * Verifies the React Compiler's automatic memoization lowering, reactive scope
 * cache slots (`$[]`), referential stability, and negative proofs demonstrating
 * mutation bailouts.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 09: React Compiler & Memoization Lowering ===");

// 1. Reactive Scope Cache Slot Lowering Simulation
// The React Compiler transforms code by identifying reactive scopes and inserting
// a local cache array (conventionally named `$`).
//
// Original code:
// function TodoList({ todos, filter }: { todos: string[]; filter: string }) {
//   const filtered = todos.filter(t => t.includes(filter));
//   return <List items={filtered} />;
// }
//
// Lowered code (conceptual):
// function TodoList_Lowered($: any[], todos: string[], filter: string) {
//   let t0;
//   if ($[0] !== todos || $[1] !== filter) {
//     t0 = todos.filter(t => t.includes(filter));
//     $[0] = todos;
//     $[1] = filter;
//     $[2] = t0;
//   } else {
//     t0 = $[2];
//   }
//   return { type: "List", props: { items: t0 } };
// }

class LoweredComponentRunner {
  cache: any[] = [];
  executionCounts = { filterCalculated: 0, elementsCreated: 0 };

  render(todos: readonly string[], filter: string) {
    const $ = this.cache;

    let filteredTodos: readonly string[];
    // Reactive Scope 0: Compute filtered list
    if ($[0] !== todos || $[1] !== filter) {
      this.executionCounts.filterCalculated++;
      filteredTodos = todos.filter((t) => t.includes(filter));
      $[0] = todos;
      $[1] = filter;
      $[2] = filteredTodos;
    } else {
      // Cache hit: reuse memoized array reference!
      filteredTodos = $[2];
    }

    // Reactive Scope 1: JSX Element construction
    let element: { type: string; props: { items: readonly string[] } };
    if ($[3] !== filteredTodos) {
      this.executionCounts.elementsCreated++;
      element = { type: "List", props: { items: filteredTodos } };
      $[3] = filteredTodos;
      $[4] = element;
    } else {
      element = $[4];
    }

    return element;
  }
}

{
  const runner = new LoweredComponentRunner();
  const todosA: readonly string[] = ["apple", "banana", "apricot"];

  // Pass 1: Mount render
  const v1 = runner.render(todosA, "ap");
  assert.equal(runner.executionCounts.filterCalculated, 1);
  assert.equal(runner.executionCounts.elementsCreated, 1);
  assert.deepEqual(v1.props.items, ["apple", "apricot"]);

  // Pass 2: Re-render with identical inputs
  const v2 = runner.render(todosA, "ap");
  assert.equal(runner.executionCounts.filterCalculated, 1, "Filter computation skipped on cache hit");
  assert.equal(runner.executionCounts.elementsCreated, 1, "JSX Element recreation skipped on cache hit");
  assert.equal(v1, v2, "Referential identity of returned element preserved");
  assert.equal(v1.props.items, v2.props.items, "Referential identity of props.items preserved");

  // Pass 3: Filter changes
  const v3 = runner.render(todosA, "ban");
  assert.equal(runner.executionCounts.filterCalculated, 2, "Filter re-runs when dependency changes");
  assert.equal(runner.executionCounts.elementsCreated, 2, "JSX Element re-created when dependency changes");
  assert.deepEqual(v3.props.items, ["banana"]);

  console.log("✓ React Compiler reactive scope cache lowering verified.");
}

// 2. Negative Proof: In-Place Mutation Destroys Compiler Cache Invariants
{
  const runner = new LoweredComponentRunner();
  const mutableTodos: string[] = ["alpha", "beta"];

  // Mount
  const render1 = runner.render(mutableTodos, "al");
  assert.deepEqual(render1.props.items, ["alpha"]);

  // ANTI-PATTERN: Mutating array in-place without creating new reference
  mutableTodos.push("alchemy");

  // Re-render: pass the same mutable array reference
  const render2 = runner.render(mutableTodos, "al");

  // BUG: Because `$[0] === mutableTodos` holds true (same object reference!),
  // the compiler assumes nothing changed and reuses $[2], failing to include "alchemy"!
  assert.equal(
    render2.props.items.length,
    1,
    "Negative proof: In-place array mutation fails to invalidate compiler cache, dropping new items"
  );

  // FIX: Immutable copy-on-write creates new array reference
  const immutableTodos = [...mutableTodos];
  const render3 = runner.render(immutableTodos, "al");
  assert.equal(
    render3.props.items.length,
    2,
    "Copy-on-write correctly changes reference, prompting compiler to re-run filter"
  );
  assert.deepEqual(render3.props.items, ["alpha", "alchemy"]);

  console.log("✓ Negative proof: In-place mutation breaks cache invariant; copy-on-write required.");
}

console.log("All 09 Compiler Memoization Lowering tests passed successfully!\n");
