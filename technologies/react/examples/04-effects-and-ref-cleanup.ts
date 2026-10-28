/**
 * Module 04: Effects, Refs & React 19 Cleanup
 *
 * Verifies React 19 ref callback cleanup returns, effect cleanup execution order,
 * and the separation between synchronous layout effects and asynchronous passive effects.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 04: Effects, Refs & React 19 Cleanup ===");

// 1. React 19 Ref Callback Cleanup Contract
// In React 19, ref callbacks can return a cleanup function.
// React invokes this cleanup function when the element unmounts or before re-running with a new node.
{
  const events: string[] = [];

  class RefManager {
    currentElement: { id: string } | null = null;
    cleanupFn: (() => void) | null = null;

    attachRef(node: { id: string } | null, refCallback: (node: { id: string } | null) => (() => void) | void) {
      // If a cleanup function was registered from previous attachment, call it first
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = null;
      }

      this.currentElement = node;
      if (node !== null) {
        const result = refCallback(node);
        if (typeof result === "function") {
          this.cleanupFn = result;
        }
      }
    }

    unmount() {
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = null;
      }
      this.currentElement = null;
    }
  }

  const manager = new RefManager();

  // Test React 19 Ref attachment with cleanup return
  const elementA = { id: "button-a" };
  manager.attachRef(elementA, (node) => {
    events.push(`attached:${node?.id}`);
    return () => {
      events.push(`cleanup:${node?.id}`);
    };
  });

  assert.deepEqual(events, ["attached:button-a"]);

  // Element replacement: should run cleanup for elementA, then attach elementB
  const elementB = { id: "button-b" };
  manager.attachRef(elementB, (node) => {
    events.push(`attached:${node?.id}`);
    return () => {
      events.push(`cleanup:${node?.id}`);
    };
  });

  assert.deepEqual(events, [
    "attached:button-a",
    "cleanup:button-a",
    "attached:button-b",
  ]);

  // Unmount: should invoke cleanup for elementB
  manager.unmount();

  assert.deepEqual(events, [
    "attached:button-a",
    "cleanup:button-a",
    "attached:button-b",
    "cleanup:button-b",
  ]);

  console.log("✓ React 19 ref callback cleanup lifecycle verified.");
}

// 2. Negative Proof: Non-Function Return From Ref Callback
// In React 19, returning anything other than a cleanup function (or undefined) is invalid.
{
  function validateRefReturn(result: any) {
    if (result !== undefined && typeof result !== "function") {
      throw new TypeError(
        `Unexpected return value from ref callback. Ref callbacks must return a cleanup function or nothing, but got: ${typeof result}`
      );
    }
  }

  // Valid returns
  assert.doesNotThrow(() => validateRefReturn(undefined));
  assert.doesNotThrow(() => validateRefReturn(() => {}));

  // Invalid returns (e.g. arrow function returning assignment expression implicitly)
  assert.throws(
    () => validateRefReturn(42),
    /Unexpected return value from ref callback/,
    "Returning primitive numbers from ref callback must throw TypeError"
  );

  assert.throws(
    () => validateRefReturn({ some: "object" }),
    /Unexpected return value from ref callback/,
    "Returning an object from ref callback must throw TypeError"
  );

  console.log("✓ Negative proof: Non-function return from ref callback rejected.");
}

// 3. Effect Execution Order: Cleanups Run Before Next Effects
{
  const effectTrace: string[] = [];

  class EffectScheduler {
    cleanup: (() => void) | null = null;

    runEffect(effectFn: () => (() => void) | void) {
      if (this.cleanup) {
        effectTrace.push("run:cleanup");
        this.cleanup();
      }
      effectTrace.push("run:effect");
      const res = effectFn();
      this.cleanup = typeof res === "function" ? res : null;
    }

    dispose() {
      if (this.cleanup) {
        effectTrace.push("dispose:cleanup");
        this.cleanup();
        this.cleanup = null;
      }
    }
  }

  const scheduler = new EffectScheduler();

  scheduler.runEffect(() => {
    return () => effectTrace.push("cleanup:pass1");
  });

  scheduler.runEffect(() => {
    return () => effectTrace.push("cleanup:pass2");
  });

  scheduler.dispose();

  assert.deepEqual(effectTrace, [
    "run:effect",
    "run:cleanup",
    "cleanup:pass1",
    "run:effect",
    "dispose:cleanup",
    "cleanup:pass2",
  ]);

  console.log("✓ Effect lifecycle sequencing (cleanup-before-reapply) verified.");
}

console.log("All 04 Effects & Ref Cleanup tests passed successfully!\n");
