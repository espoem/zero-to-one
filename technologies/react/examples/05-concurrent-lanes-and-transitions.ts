/**
 * Module 05: Concurrent Rendering & Priority Lanes
 *
 * Verifies the 31-bit Lane priority bitmask model, bitwise algebra (least-significant-bit priority),
 * transition preemption mechanics, and prevention of state tearing.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 05: Concurrent Rendering & Priority Lanes ===");

// 1. Lane Definitions & Bitwise Algebra
const NoLanes = 0b0;
const SyncLane = 0b0000000000000000000000000000001; // Highest priority
const InputContinuousLane = 0b0000000000000000000000000000100;
const DefaultLane = 0b0000000000000000000000010000000;
const TransitionLane1 = 0b0000000000000000000001000000000;
const TransitionLane2 = 0b0000000000000000000010000000000;
const IdleLane = 0b0100000000000000000000000000000; // Lowest priority

// React uses `lanes & -lanes` (two's complement) to extract the lowest set bit,
// which represents the highest priority lane pending.
function getHighestPriorityLane(lanes: number): number {
  return lanes & -lanes;
}

function mergeLanes(a: number, b: number): number {
  return a | b;
}

function removeLanes(set: number, subset: number): number {
  return set & ~subset;
}

function includesSomeLane(a: number, b: number): boolean {
  return (a & b) !== NoLanes;
}

{
  let pendingLanes = NoLanes;

  // Enqueue a non-urgent transition
  pendingLanes = mergeLanes(pendingLanes, TransitionLane1);
  assert.equal(getHighestPriorityLane(pendingLanes), TransitionLane1);

  // Enqueue a low-priority idle task
  pendingLanes = mergeLanes(pendingLanes, IdleLane);
  assert.equal(getHighestPriorityLane(pendingLanes), TransitionLane1, "Transition has priority over Idle");

  // An urgent user click arrives (SyncLane)
  pendingLanes = mergeLanes(pendingLanes, SyncLane);
  assert.equal(
    getHighestPriorityLane(pendingLanes),
    SyncLane,
    "SyncLane (urgent click) preempts pending Transition and Idle lanes"
  );

  // Process SyncLane and remove it
  pendingLanes = removeLanes(pendingLanes, SyncLane);
  assert.equal(
    getHighestPriorityLane(pendingLanes),
    TransitionLane1,
    "After SyncLane commit, scheduler falls back to TransitionLane1"
  );

  console.log("✓ Lane bitmask algebra and priority preemption verified.");
}

// 2. Time-Sliced Scheduling Simulation & Interruption
{
  const executionLog: string[] = [];
  let urgentInterruptPending = false;

  function performTimeSlicedRender(items: string[], lane: number) {
    for (let i = 0; i < items.length; i++) {
      if (urgentInterruptPending && lane === TransitionLane1) {
        executionLog.push("yield:preempted-by-urgent");
        return { completed: false, nextIndex: i };
      }
      executionLog.push(`render:${items[i]}`);
    }
    return { completed: true, nextIndex: items.length };
  }

  const heavyList = ["row-1", "row-2", "row-3", "row-4"];

  // Start transition render
  executionLog.push("start:transition");
  const step1 = performTimeSlicedRender(heavyList.slice(0, 2), TransitionLane1);
  assert.equal(step1.completed, true);

  // Urgent interrupt triggered
  urgentInterruptPending = true;
  const step2 = performTimeSlicedRender(heavyList.slice(2), TransitionLane1);
  assert.equal(step2.completed, false);
  assert.equal(executionLog.includes("yield:preempted-by-urgent"), true);

  // Execute urgent sync update
  executionLog.push("start:sync-click");
  performTimeSlicedRender(["modal-open"], SyncLane);
  executionLog.push("commit:modal-open");
  urgentInterruptPending = false;

  // When React restarts an interrupted transition pass, it discards the incomplete
  // work-in-progress tree and restarts rendering fresh to incorporate new committed state.
  executionLog.push("restart:transition");
  performTimeSlicedRender(heavyList, TransitionLane1);
  executionLog.push("commit:heavyList");

  assert.deepEqual(executionLog, [
    "start:transition",
    "render:row-1",
    "render:row-2",
    "yield:preempted-by-urgent",
    "start:sync-click",
    "render:modal-open",
    "commit:modal-open",
    "restart:transition",
    "render:row-1",
    "render:row-2",
    "render:row-3",
    "render:row-4",
    "commit:heavyList",
  ]);

  console.log("✓ Time-sliced transition interruption and resumption verified.");
}

// 3. Negative Proof: Tearing Prevention via Snapshot Consistency
{
  // If an external store changes midway through render without snapshot isolation,
  // different components read different versions (tearing).
  let externalStoreValue = "version-A";

  function readStoreWithoutIsolation() {
    return externalStoreValue;
  }

  function readStoreWithSnapshotIsolation(snapshot: string) {
    return snapshot;
  }

  // Component 1 renders and reads version-A
  const snapshotAtRenderStart = externalStoreValue;
  const comp1Isolated = readStoreWithSnapshotIsolation(snapshotAtRenderStart);
  const comp1NonIsolated = readStoreWithoutIsolation();

  // External store mutates mid-render (e.g. via outside websocket event)
  externalStoreValue = "version-B";

  // Component 2 renders in same tree
  const comp2Isolated = readStoreWithSnapshotIsolation(snapshotAtRenderStart);
  const comp2NonIsolated = readStoreWithoutIsolation();

  // Non-isolated execution exhibits tearing: comp1 had A, comp2 has B
  assert.notEqual(
    comp1NonIsolated,
    comp2NonIsolated,
    "Negative proof: Non-isolated reads tear between components in same pass"
  );

  // Snapshot isolation guarantees consistency: both comp1 and comp2 see version-A
  assert.equal(comp1Isolated, comp2Isolated, "Snapshot isolation guarantees no tearing");
  assert.equal(comp1Isolated, "version-A");

  console.log("✓ Negative proof: State tearing detected and prevented via snapshot consistency.");
}

console.log("All 05 Concurrent Lanes & Transitions tests passed successfully!\n");
