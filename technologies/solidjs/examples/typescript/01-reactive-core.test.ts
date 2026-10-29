/**
 * Module 01 — Reactive core: signals, memos, batching, ownership.
 * Runs against the real solid-js@2.0.0-rc.19 development build (client posture).
 */
import { describe, it, expect } from "vitest";
import {
  createSignal,
  createMemo,
  createRoot,
  flush,
  untrack,
  onCleanup,
  getOwner,
  runWithOwner,
  isEqual,
  createEffect,
  resetErrorHalt,
} from "solid-js";
import { captureDiagnostics, tick } from "./support/diagnostics.ts";

describe("01 · signals and the commit point", () => {
  it("reads return the last committed value until flush()", () => {
    const [count, setCount] = createSignal(0);
    setCount(1);
    expect(count()).toBe(0); // queued, not committed
    flush();
    expect(count()).toBe(1);
  });

  it("an un-flushed write commits on the next microtask", async () => {
    const [count, setCount] = createSignal(0);
    setCount(5);
    expect(count()).toBe(0);
    await tick();
    expect(count()).toBe(5);
  });

  it("flush(fn) drains the writes made inside fn before returning", () => {
    const [a, setA] = createSignal(1);
    const [b, setB] = createSignal(1);
    const sum = flush(() => {
      setA(10);
      setB(20);
      return "done";
    });
    expect(sum).toBe("done"); // the callback's return value is preserved
    expect(a() + b()).toBe(30);
  });

  it("updater form composes queued writes", () => {
    const [n, setN] = createSignal(0);
    setN((v) => v + 1);
    setN((v) => v + 1);
    flush();
    expect(n()).toBe(2);
  });

  it("writing an equal value (===) does not propagate", () => {
    const { m, runs, setX, dispose } = createRoot((dispose) => {
      const [x, setX] = createSignal(1);
      let runs = 0;
      const m = createMemo(() => (runs++, x()));
      return { m, runs: () => runs, setX, dispose };
    });
    setX(1);
    flush();
    expect(m()).toBe(1);
    expect(runs()).toBe(1);
    dispose();
  });

  it("custom equals suppresses notifications; equals:false always notifies", () => {
    const { label, runsA, setUser, setTick, runsB, dispose } = createRoot((dispose) => {
      const [user, setUser] = createSignal({ id: 1, name: "Ada" }, { equals: (a, b) => a.id === b.id });
      let runsA = 0;
      const label = createMemo(() => (runsA++, user().name));
      const [tickV, setTick] = createSignal(0, { equals: false });
      let runsB = 0;
      createMemo(() => (runsB++, tickV()));
      return { label, runsA: () => runsA, setUser, setTick, runsB: () => runsB, dispose };
    });
    setUser({ id: 1, name: "Grace" }); // same id → "equal" → ignored entirely
    setTick(0); // same value, but equals:false → notifies
    flush();
    expect(label()).toBe("Ada");
    expect(runsA()).toBe(1);
    expect(runsB()).toBe(2);
    expect(isEqual(1, 1)).toBe(true); // the default comparator is exported
    dispose();
  });
});

describe("01 · memos: push-pull and glitch freedom", () => {
  it("non-lazy memos compute eagerly at creation and once per commit", () => {
    const { doubled, runs, setCount, dispose } = createRoot((dispose) => {
      const [count, setCount] = createSignal(0);
      let runs = 0;
      const doubled = createMemo(() => (runs++, count() * 2));
      return { doubled, runs: () => runs, setCount, dispose };
    });
    expect(runs()).toBe(1); // eager
    setCount(1);
    setCount(2);
    setCount(3);
    flush();
    expect(doubled()).toBe(6);
    expect(runs()).toBe(2); // three writes, one recompute
    dispose();
  });

  it("diamond dependency: the sink runs once and never observes a torn state", () => {
    const { seen, setA, dispose } = createRoot((dispose) => {
      const [a, setA] = createSignal(1);
      const b = createMemo(() => a() + 1);
      const c = createMemo(() => a() * 10);
      const seen: Array<[number, number]> = [];
      createMemo(() => {
        seen.push([b(), c()]);
      });
      return { seen, setA, dispose };
    });
    setA(2);
    flush();
    // Glitch freedom: never [3, 10] or [2, 20] — only consistent snapshots.
    expect(seen).toEqual([
      [2, 10],
      [3, 20],
    ]);
    dispose();
  });

  it("a memo whose value did not change stops propagation (equality cut-off)", () => {
    const { downstreamRuns, setN, dispose } = createRoot((dispose) => {
      const [n, setN] = createSignal(2);
      const isEven = createMemo(() => n() % 2 === 0);
      let downstreamRuns = 0;
      createMemo(() => (downstreamRuns++, isEven()));
      return { downstreamRuns: () => downstreamRuns, setN, dispose };
    });
    setN(4); // isEven recomputes but stays true
    flush();
    expect(downstreamRuns()).toBe(1);
    dispose();
  });

  it("lazy memos defer the first compute until read", () => {
    const { lazy, runs, dispose } = createRoot((dispose) => {
      const [x] = createSignal(1);
      let runs = 0;
      const lazy = createMemo(() => (runs++, x() + 1), { lazy: true });
      return { lazy, runs: () => runs, dispose };
    });
    expect(runs()).toBe(0);
    expect(lazy()).toBe(2);
    expect(runs()).toBe(1);
    dispose();
  });

  it("unobserved fires when the last subscriber goes away", () => {
    const { unobservedCalls, setShow, dispose } = createRoot((dispose) => {
      let unobservedCalls = 0;
      const [source] = createSignal(0, { unobserved: () => unobservedCalls++ });
      const [show, setShow] = createSignal(true);
      createMemo(() => (show() ? source() : -1)); // dynamic dependency
      return { unobservedCalls: () => unobservedCalls, setShow, dispose };
    });
    expect(unobservedCalls()).toBe(0);
    setShow(false); // the memo stops reading `source`
    flush();
    expect(unobservedCalls()).toBe(1);
    dispose();
  });

  it("dependencies are dynamic: only the branch actually read is tracked", () => {
    const { runs, setUseA, setB, dispose } = createRoot((dispose) => {
      const [useA, setUseA] = createSignal(true);
      const [a] = createSignal("a");
      const [b, setB] = createSignal("b");
      let runs = 0;
      createMemo(() => (runs++, useA() ? a() : b()));
      return { runs: () => runs, setUseA, setB, dispose };
    });
    setB("b2"); // not a dependency yet
    flush();
    expect(runs()).toBe(1);
    setUseA(false);
    flush();
    setB("b3"); // now it is
    flush();
    expect(runs()).toBe(3);
    dispose();
  });
});

describe("01 · writable derived signals (createSignal(fn))", () => {
  it("a write lands at once; a source change re-derives with the write as prev", () => {
    const { value, setValue, setSource, dispose } = createRoot((dispose) => {
      const [source, setSource] = createSignal(1);
      const [value, setValue] = createSignal(() => source() * 10);
      return { value, setValue, setSource, dispose };
    });
    expect(value()).toBe(10);
    setValue(5);
    flush();
    expect(value()).toBe(5); // local override
    setSource(2);
    flush();
    expect(value()).toBe(20); // fn ignores prev → source wins again
    dispose();
  });

  it("a flag in the data lets the function keep a local value (prev-aware derivation)", () => {
    type Card = { column: string; pinned?: boolean };
    const { card, setCard, setServer, dispose } = createRoot((dispose) => {
      const [server, setServer] = createSignal<Card>({ column: "todo" });
      const [card, setCard] = createSignal<Card>((prev) => {
        const next = server(); // read unconditionally so the dependency survives while pinned
        return prev?.pinned ? prev : next;
      });
      return { card, setCard, setServer, dispose };
    });
    setCard({ column: "done", pinned: true });
    flush();
    setServer({ column: "doing" });
    flush();
    expect(card()).toEqual({ column: "done", pinned: true });
    dispose();
  });
});

describe("01 · ownership and disposal", () => {
  it("a nested createRoot is owned by its parent by default", () => {
    const log: string[] = [];
    const dispose = createRoot((dispose) => {
      createRoot(() => onCleanup(() => log.push("inner")));
      return dispose;
    });
    dispose();
    expect(log).toEqual(["inner"]);
  });

  it("runWithOwner(null, …) detaches explicitly", () => {
    const log: string[] = [];
    let detachedDispose!: () => void;
    const dispose = createRoot((dispose) => {
      runWithOwner(null, () =>
        createRoot((d) => {
          detachedDispose = d;
          onCleanup(() => log.push("detached"));
        }),
      );
      return dispose;
    });
    dispose();
    expect(log).toEqual([]); // survived its would-be parent
    detachedDispose();
    expect(log).toEqual(["detached"]);
  });

  it("cleanups unwind: children before parent, later registrations first", () => {
    const log: string[] = [];
    const dispose = createRoot((dispose) => {
      onCleanup(() => log.push("parent-1"));
      createRoot(() => onCleanup(() => log.push("child")));
      onCleanup(() => log.push("parent-2"));
      return dispose;
    });
    dispose();
    expect(log).toEqual(["child", "parent-2", "parent-1"]);
  });

  it("getOwner/runWithOwner re-enter an owner after an await", async () => {
    const log: string[] = [];
    const { owner, dispose } = createRoot((dispose) => ({ owner: getOwner(), dispose }));
    await tick();
    expect(getOwner()).toBeNull(); // the async continuation lost the owner…
    runWithOwner(owner, () => onCleanup(() => log.push("re-entered"))); // …so restore it
    dispose();
    expect(log).toEqual(["re-entered"]);
  });

  it("untrack reads without subscribing", () => {
    const { runs, setB, dispose } = createRoot((dispose) => {
      const [a] = createSignal(1);
      const [b, setB] = createSignal(1);
      let runs = 0;
      createMemo(() => (runs++, a() + untrack(b)));
      return { runs: () => runs, setB, dispose };
    });
    setB(2);
    flush();
    expect(runs()).toBe(1);
    dispose();
  });
});

describe("01 · negative: writes inside an owned scope", () => {
  it("throws REACTIVE_WRITE_IN_OWNED_SCOPE when a root/component body writes", () => {
    const { codes } = captureDiagnostics(() =>
      expect(() =>
        createRoot((dispose) => {
          const [, setCount] = createSignal(0);
          try {
            setCount(1);
          } finally {
            dispose();
          }
        }),
      ).toThrow(/REACTIVE_WRITE_IN_OWNED_SCOPE/),
    );
    expect(codes).toContain("REACTIVE_WRITE_IN_OWNED_SCOPE");
  });

  it("untrack does not exempt the write: the guard is owner-based", () => {
    createRoot((dispose) => {
      const [, setCount] = createSignal(0);
      expect(() => untrack(() => setCount(1))).toThrow(/REACTIVE_WRITE_IN_OWNED_SCOPE/);
      dispose();
    });
  });

  it("a memo that writes surfaces the error when it is read", () => {
    createRoot((dispose) => {
      const [, setOther] = createSignal(0);
      const bad = createMemo(() => {
        setOther(1);
        return 1;
      });
      expect(() => bad()).toThrow(/REACTIVE_WRITE_IN_OWNED_SCOPE/);
      dispose();
    });
  });

  it("ownedWrite: true is the narrow, explicit opt-in", () => {
    createRoot((dispose) => {
      const [flag, setFlag] = createSignal(false, { ownedWrite: true });
      expect(() => setFlag(true)).not.toThrow();
      flush();
      expect(flag()).toBe(true);
      dispose();
    });
  });
});

describe("01 · internals and production failure modes", () => {
  it("dormancy: an untracked read of a subscriber-less memo lets the next flush sweep it; a later read revives it", () => {
    const [s, setS] = createSignal(1);
    let runs = 0;
    const m = createMemo(() => (runs++, s())); // no owner, no subscriber
    expect(m()).toBe(1); // untracked read → queued as dormant
    expect(runs).toBe(1);
    setS(2);
    flush(); // the sweep unlinks the dormant memo before the heap runs: no recompute
    expect(runs).toBe(1);
    expect(m()).toBe(2); // the read revives it with a full recompute
    expect(runs).toBe(2);
  });

  it("dynamic dependencies raise height: a node that starts reading a deeper memo is re-ordered after it", () => {
    const order: string[] = [];
    const { setUseDeep, setBase, dispose } = createRoot((dispose) => {
      const [base, setBase] = createSignal(1);
      const [useDeep, setUseDeep] = createSignal(false);
      const d1 = createMemo(() => base() + 1);
      const d2 = createMemo(() => d1() + 1); // height 2
      const d3 = createMemo(() => (order.push(`d3 sees d2=${d2()}`), d2() + 1)); // height 3
      createMemo(() => {
        const v = useDeep() ? d3() : base();
        order.push(`sink ${v}`);
      });
      return { setUseDeep, setBase, dispose };
    });
    order.length = 0;
    setUseDeep(true);
    flush();
    setBase(10);
    flush();
    // After the switch the sink depends on d3 (height 3) and must run after it in the same pass.
    expect(order.slice(-2)).toEqual(["d3 sees d2=12", "sink 13"]);
    dispose();
  });

  it("negative: an effect created without an owner keeps running forever (NO_OWNER_EFFECT)", () => {
    const [s, setS] = createSignal(0);
    let runs = 0;
    const { codes } = captureDiagnostics(() => {
      createEffect(
        () => s(),
        () => {
          runs++;
        },
      );
    });
    flush();
    setS(1);
    flush();
    setS(2);
    flush();
    expect(codes).toContain("NO_OWNER_EFFECT");
    expect(runs).toBe(3); // nothing can dispose it: a leak for the lifetime of `s`
  });

  it("negative: a read outside any tracking scope is a snapshot, not a subscription", () => {
    const [n, setN] = createSignal(1);
    const label = `n is ${n()}`; // plain read at module/handler level
    const { live, dispose } = createRoot((dispose) => ({ live: createMemo(() => `n is ${n()}`), dispose }));
    setN(2);
    flush();
    expect(label).toBe("n is 1");
    expect(live()).toBe("n is 2");
    dispose();
  });

  it("negative: an effect that writes its own source loops until the runtime gives up", () => {
    let error: unknown;
    const { x, dispose } = createRoot((dispose) => {
      const [x, setX] = createSignal(0);
      createEffect(
        () => x(),
        (v) => {
          setX(v + 1); // ❌ unbounded feedback through the apply half
        },
      );
      return { x, dispose };
    });
    try {
      flush();
    } catch (e) {
      error = e;
    }
    expect(String(error)).toMatch(/Potential Infinite Loop Detected/);
    expect(x()).toBeGreaterThan(90_000); // ~100k iterations ran first
    dispose();
    resetErrorHalt();
  });
});
