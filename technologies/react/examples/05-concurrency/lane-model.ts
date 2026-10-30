/**
 * A readable model of React's lane bitmask as shipped in react-dom@19.3.1
 * (ReactFiberLane.js). Lane values are INTERNAL and change between releases; the test
 * suite checks this model against the function extracted from the installed build.
 */
export const Lane = {
  NoLanes: 0,
  SyncHydrationLane: 1 << 0,
  SyncLane: 1 << 1, // discrete events: click, keydown, flushSync
  InputContinuousHydrationLane: 1 << 2,
  InputContinuousLane: 1 << 3, // continuous events: pointermove, scroll, wheel
  DefaultHydrationLane: 1 << 4,
  DefaultLane: 1 << 5, // updates outside events: timers, network callbacks, root.render
  GestureLane: 1 << 6,
  TransitionHydrationLane: 1 << 7,
  /** 10 lanes, bits 8–17, assigned round-robin to startTransition updates. */
  TransitionUpdateLanes: 0b11_1111_1111 << 8,
  /** 4 lanes, bits 18–21, for useDeferredValue's deferred render. */
  TransitionDeferredLanes: 0b1111 << 18,
  /** 4 lanes, bits 22–25, for re-trying suspended Suspense boundaries. */
  RetryLanes: 0b1111 << 22,
  SelectiveHydrationLane: 1 << 26,
  IdleHydrationLane: 1 << 27,
  IdleLane: 1 << 28,
  OffscreenLane: 1 << 29, // hidden <Activity> content and pre-rendering
  DeferredLane: 1 << 30,
} as const;

/** Sync, InputContinuous and Default are batched together as "blocking" work (unified sync lane). */
export const SyncUpdateLanes = Lane.SyncLane | Lane.InputContinuousLane | Lane.DefaultLane;

export const lowestSetBit = (lanes: number): number => lanes & -lanes;
export const mergeLanes = (a: number, b: number): number => a | b;
export const removeLanes = (set: number, subset: number): number => set & ~subset;
export const includesSomeLane = (a: number, b: number): boolean => (a & b) !== 0;
export const isSubsetOfLanes = (set: number, subset: number): boolean => (set & subset) === subset;

/**
 * Which lanes should the next render work on, given the pending set?
 * Lower bit = higher priority. Most lanes render alone; some groups render together.
 */
export function getHighestPriorityLanes(lanes: number): number {
  const pendingSync = lanes & SyncUpdateLanes;
  if (pendingSync !== 0) return pendingSync; // batch all blocking work
  const lowest = lowestSetBit(lanes);
  if (lowest & Lane.TransitionUpdateLanes) return lowest; // 19.3: each transition renders on its own
  if (lowest & Lane.TransitionDeferredLanes) return lanes & Lane.TransitionDeferredLanes;
  if (lowest & Lane.RetryLanes) return lanes & Lane.RetryLanes;
  if (lowest === Lane.DeferredLane) return Lane.NoLanes; // never rendered on its own
  return lowest;
}

/**
 * react-dom 19.2.x behaviour (checked by hand against the 19.2.9 build on 2026-10-29:
 * `case 256 … case 131072: return lanes & 261888`): every pending transition-update lane
 * was rendered together, so one suspended transition held back unrelated ones (entanglement).
 */
export function getHighestPriorityLanes_19_2(lanes: number): number {
  const pendingSync = lanes & SyncUpdateLanes;
  if (pendingSync !== 0) return pendingSync;
  if (lowestSetBit(lanes) & Lane.TransitionUpdateLanes) return lanes & Lane.TransitionUpdateLanes;
  return getHighestPriorityLanes(lanes);
}
