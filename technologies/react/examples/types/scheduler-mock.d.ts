// Minimal declarations for the parts of scheduler@0.28 "unstable_mock" used by the examples.
declare module "scheduler/unstable_mock" {
  export type PriorityLevel = 1 | 2 | 3 | 4 | 5;
  export const unstable_ImmediatePriority: 1;
  export const unstable_UserBlockingPriority: 2;
  export const unstable_NormalPriority: 3;
  export const unstable_LowPriority: 4;
  export const unstable_IdlePriority: 5;
  export type Callback = (didTimeout: boolean) => Callback | void | unknown;
  export function unstable_scheduleCallback(priority: PriorityLevel, cb: Callback): unknown;
  export function unstable_shouldYield(): boolean;
  export function unstable_now(): number;
  export function unstable_advanceTime(ms: number): void;
  export function unstable_flushAll(): void;
  export function unstable_flushAllWithoutAsserting(): boolean;
  export function unstable_flushExpired(): void;
  export function unstable_flushNumberOfYields(count: number): void;
  export function unstable_clearLog(): unknown[];
  export function log(value: unknown): void;
  export function reset(): void;
}
