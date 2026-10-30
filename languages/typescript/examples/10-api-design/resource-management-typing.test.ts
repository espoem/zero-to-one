/**
 * Module 10 — Typing explicit resource management (`using`) and branded/assertion APIs.
 * Runtime dispose-order semantics are owned by languages/javascript; here we test the
 * *types* (Disposable, AsyncDisposable, DisposableStack) and the API shapes they enable.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

interface Connection extends Disposable {
  query(sql: string): string[];
}

function connect(log: string[]): Connection {
  return {
    query: (sql) => [sql],
    [Symbol.dispose]: () => void log.push("closed"),
  };
}

test("a function returning Disposable can be bound with `using`", () => {
  const log: string[] = [];
  {
    using conn = connect(log);
    expectTypeOf(conn).toEqualTypeOf<Connection>();
    assert.deepEqual(conn.query("select 1"), ["select 1"]);
  }
  assert.deepEqual(log, ["closed"]);
});

test("only Disposable values (or null/undefined) may be bound with `using`", () => {
  // The compiler rejects it, and so does the runtime: the check is the same on both sides.
  assert.throws(() => {
    // @ts-expect-error — the initializer must have a [Symbol.dispose]() method
    using notDisposable = { close() {} };
    void notDisposable;
  }, TypeError);
  using nothing = null; // allowed: null and undefined are skipped
  void nothing;
});

test("DisposableStack collects heterogeneous cleanups with typed adopt/defer", () => {
  const log: string[] = [];
  {
    using stack = new DisposableStack();
    const handle = stack.adopt({ fd: 3 }, (h) => log.push(`close fd ${h.fd}`));
    expectTypeOf(handle).toEqualTypeOf<{ fd: number }>();
    stack.defer(() => log.push("deferred"));
    stack.use(connect(log));
  }
  // Disposal is LIFO; the exact ordering rules are taught in languages/javascript.
  assert.deepEqual(log, ["closed", "deferred", "close fd 3"]);
});

test("AsyncDisposable requires `await using`", async () => {
  const log: string[] = [];
  const pool: AsyncDisposable = { [Symbol.asyncDispose]: async () => void log.push("drained") };
  {
    await using p = pool;
    void p;
  }
  assert.deepEqual(log, ["drained"]);
});
