/**
 * Hands-on H-002 (exams/certificates-dev-typescript.md): a typed event emitter.
 * Task: implement `createEmitter<Events>()` whose `on`, `off` and `emit` are typed by
 * an event map, where `on` returns a Disposable unsubscribe handle.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

type Listener<P> = (payload: P) => void;

export interface Emitter<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(name: K, listener: Listener<Events[K]>): Disposable;
  off<K extends keyof Events>(name: K, listener: Listener<Events[K]>): void;
  emit<K extends keyof Events>(name: K, ...payload: Events[K] extends void ? [] : [Events[K]]): number;
}

export function createEmitter<Events extends Record<string, unknown>>(): Emitter<Events> {
  const listeners = new Map<keyof Events, Set<Listener<never>>>();
  const emitter: Emitter<Events> = {
    on(name, listener) {
      let set = listeners.get(name);
      if (!set) listeners.set(name, (set = new Set()));
      set.add(listener as Listener<never>);
      return { [Symbol.dispose]: () => emitter.off(name, listener) };
    },
    off(name, listener) {
      listeners.get(name)?.delete(listener as Listener<never>);
    },
    emit(name, ...payload) {
      const set = listeners.get(name);
      for (const l of set ?? []) (l as Listener<unknown>)(payload[0]);
      return set?.size ?? 0;
    },
  };
  return emitter;
}

type AppEvents = { login: { userId: string }; logout: void };

test("H-002 types: payloads follow the event map", () => {
  const e = createEmitter<AppEvents>();
  e.on("login", (p) => expectTypeOf(p).toEqualTypeOf<{ userId: string }>());
  // @ts-expect-error — login requires a payload
  e.emit("login");
  // @ts-expect-error — logout takes no payload
  e.emit("logout", { userId: "x" });
  // @ts-expect-error — unknown event
  e.on("signup", () => {});
});

test("H-002 runtime: listeners run, and `using` unsubscribes", () => {
  const e = createEmitter<AppEvents>();
  const seen: string[] = [];
  {
    using _sub = e.on("login", (p) => seen.push(p.userId));
    assert.equal(e.emit("login", { userId: "ada" }), 1);
  }
  assert.equal(e.emit("login", { userId: "bob" }), 0);
  assert.equal(e.emit("logout"), 0);
  assert.deepEqual(seen, ["ada"]);
});
