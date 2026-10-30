// @vitest-environment jsdom
/**
 * Module 05 — Concurrency: lanes, transitions, deferred values, <Activity>.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Activity,
  Suspense,
  act,
  startTransition,
  use,
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Scheduler from "scheduler/unstable_mock";
import {
  Lane,
  getHighestPriorityLanes,
  getHighestPriorityLanes_19_2,
  isSubsetOfLanes,
  lowestSetBit,
  mergeLanes,
  removeLanes,
} from "./lane-model.ts";

let roots: Root[] = [];
async function mount(node: ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return { container, root };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("lanes: a bitmask algebra (model vs the shipped react-dom build)", () => {
  /** Extract getHighestPriorityLanes from the installed react-dom development build. */
  function realGetHighestPriorityLanes(): (lanes: number) => number {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve("react-dom/package.json");
    const file = pkg.replace(/package\.json$/, "cjs/react-dom-client.development.js");
    const src = readFileSync(file, "utf8");
    const start = src.indexOf("function getHighestPriorityLanes(lanes)");
    const end = src.indexOf("function getNextLanes(", start);
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, end);
    return new Function("console", `${body}; return getHighestPriorityLanes;`)({ error() {} });
  }

  test("lowest set bit = highest priority (two's complement trick)", () => {
    const pending = Lane.SyncLane | Lane.DefaultLane | (1 << 9);
    expect(lowestSetBit(pending)).toBe(Lane.SyncLane);
    expect(removeLanes(pending, Lane.SyncLane)).toBe(Lane.DefaultLane | (1 << 9));
    expect(isSubsetOfLanes(pending, Lane.DefaultLane)).toBe(true);
    expect(mergeLanes(Lane.IdleLane, Lane.OffscreenLane) & Lane.IdleLane).toBe(Lane.IdleLane);
  });

  test("property: the model equals react-dom 19.3.1's getHighestPriorityLanes for random lane sets", () => {
    const real = realGetHighestPriorityLanes();
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (lanes) => getHighestPriorityLanes(lanes) === real(lanes)),
      { numRuns: 2000 },
    );
  });

  test("19.3: two pending transition lanes are rendered separately (untangled)", () => {
    const real = realGetHighestPriorityLanes();
    const t1 = 1 << 8;
    const t2 = 1 << 9;
    expect(real(t1 | t2)).toBe(t1);
    expect(getHighestPriorityLanes_19_2(t1 | t2)).toBe(t1 | t2); // the 19.2 behaviour, modelled
  });

  test("blocking lanes (Sync, InputContinuous, Default) are batched into one render", () => {
    const real = realGetHighestPriorityLanes();
    const all = Lane.SyncLane | Lane.DefaultLane | (1 << 8);
    expect(real(all)).toBe(Lane.SyncLane | Lane.DefaultLane);
  });
});

describe("the scheduler: priority queue + cooperative yielding (scheduler/unstable_mock)", () => {
  afterEach(() => Scheduler.reset());

  test("callbacks run by priority, then by insertion order", () => {
    const log: string[] = [];
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, () => void log.push("normal-1"));
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_IdlePriority, () => void log.push("idle"));
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_UserBlockingPriority, () => void log.push("user-blocking"));
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, () => void log.push("normal-2"));
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_ImmediatePriority, () => void log.push("immediate"));
    Scheduler.unstable_flushAll();
    expect(log).toEqual(["immediate", "user-blocking", "normal-1", "normal-2", "idle"]);
  });

  // The mock replaces the 5 ms wall-clock deadline with a deterministic rule:
  // shouldYield() becomes true after N values have been passed to Scheduler.log().
  test("a task yields when shouldYield() is true and resumes via a returned continuation", () => {
    const processed: number[] = [];
    let i = 0;
    function work(): (() => unknown) | void {
      while (i < 10) {
        if (Scheduler.unstable_shouldYield()) return work; // continuation = "resume here"
        processed.push(i);
        Scheduler.log(i++);
      }
    }
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, work);
    Scheduler.unstable_flushNumberOfYields(3);
    expect(processed).toEqual([0, 1, 2]); // yielded after three units
    Scheduler.unstable_clearLog();
    Scheduler.unstable_flushAllWithoutAsserting();
    expect(processed).toHaveLength(10); // resumed from i = 3, not restarted
  });

  test("an urgent task scheduled while a long task has yielded runs before it resumes", () => {
    const order: string[] = [];
    let i = 0;
    function long(): (() => unknown) | void {
      while (i < 6) {
        if (Scheduler.unstable_shouldYield()) return long;
        order.push(`long ${i}`);
        Scheduler.log(i++);
      }
    }
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, long);
    Scheduler.unstable_flushNumberOfYields(2);
    Scheduler.unstable_clearLog();
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_UserBlockingPriority, () => void order.push("click"));
    Scheduler.unstable_flushAllWithoutAsserting();
    expect(order).toEqual(["long 0", "long 1", "click", "long 2", "long 3", "long 4", "long 5"]);
  });

  test("starvation guard: an expired low-priority task runs even if newer work keeps coming", () => {
    const log: string[] = [];
    Scheduler.unstable_scheduleCallback(Scheduler.unstable_LowPriority, () => void log.push("low"));
    Scheduler.unstable_advanceTime(20_000); // LowPriority timeout is 10 s
    Scheduler.unstable_flushExpired();
    expect(log).toEqual(["low"]);
  });
});

describe("transitions", () => {
  test("useTransition: isPending is true while the transition is outstanding", async () => {
    const data = deferred<string>();
    let go!: () => void;
    function App() {
      const [isPending, start] = useTransition();
      const [p, setP] = useState<Promise<string> | null>(null);
      go = () => start(() => setP(data.promise));
      return (
        <>
          <em>{isPending ? "pending" : "idle"}</em>
          <Suspense fallback={<b>spinner</b>}>{p ? <Show p={p} /> : <i>old</i>}</Suspense>
        </>
      );
    }
    function Show({ p }: { p: Promise<string> }) {
      return <i>{use(p)}</i>;
    }
    const { container } = await mount(<App />);
    await act(async () => go());
    // Transition: old content stays visible instead of the fallback.
    expect(container.innerHTML).toBe("<em>pending</em><i>old</i>");
    await act(async () => data.resolve("new"));
    expect(container.innerHTML).toBe("<em>idle</em><i>new</i>");
  });

  test("NEGATIVE: the same update without a transition replaces content with the fallback", async () => {
    const data = deferred<string>();
    let go!: () => void;
    function App() {
      const [p, setP] = useState<Promise<string> | null>(null);
      go = () => setP(data.promise);
      return <Suspense fallback={<b>spinner</b>}>{p ? <Show p={p} /> : <i>old</i>}</Suspense>;
    }
    function Show({ p }: { p: Promise<string> }) {
      return <i>{use(p)}</i>;
    }
    const { container } = await mount(<App />);
    await act(async () => go());
    expect(container.innerHTML).toContain("spinner");
    expect(container.innerHTML).not.toContain("<i>old</i>");
    await act(async () => data.resolve("new"));
  });

  test("19.3 untangled transitions: a suspended transition does not hold back an unrelated one", async () => {
    const slow = deferred<string>();
    let setA!: (p: Promise<string>) => void;
    let setB!: (v: string) => void;
    function A() {
      const [p, s] = useState<Promise<string> | null>(null);
      setA = s;
      return <i>{p ? use(p) : "a0"}</i>;
    }
    function B() {
      const [v, s] = useState("b0");
      setB = s;
      return <b>{v}</b>;
    }
    const { container } = await mount(
      <Suspense fallback="fallback">
        <A />
        <B />
      </Suspense>,
    );
    await act(async () => startTransition(() => setA(slow.promise)));
    await act(async () => startTransition(() => setB("b1")));
    // B's transition committed on its own lane while A's is still suspended.
    // On react-dom ≤19.2 both lanes were rendered together and B waited for A.
    expect(container.innerHTML).toBe("<i>a0</i><b>b1</b>");
    await act(async () => slow.resolve("a1"));
    expect(container.innerHTML).toBe("<i>a1</i><b>b1</b>");
  });

  test("urgent updates are not blocked by a pending transition", async () => {
    const slow = deferred<string>();
    let typeChar!: (c: string) => void;
    let search!: () => void;
    function App() {
      const [text, setText] = useState("");
      const [results, setResults] = useState<Promise<string> | null>(null);
      typeChar = (c) => setText((t) => t + c);
      search = () => startTransition(() => setResults(slow.promise));
      return (
        <>
          <input readOnly value={text} />
          <Suspense fallback="…">{results ? <R p={results} /> : null}</Suspense>
        </>
      );
    }
    function R({ p }: { p: Promise<string> }) {
      return <p>{use(p)}</p>;
    }
    const { container } = await mount(<App />);
    await act(async () => search());
    await act(async () => typeChar("a"));
    await act(async () => typeChar("b"));
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("ab");
    await act(async () => slow.resolve("results"));
    expect(container.textContent).toBe("results");
  });
});

describe("useDeferredValue", () => {
  test("renders first with the stale value, then again with the new value in the background", async () => {
    const log: string[] = [];
    function List({ query }: { query: string }) {
      const deferredQuery = useDeferredValue(query);
      log.push(`query=${query} deferred=${deferredQuery}`);
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    await act(async () => root.render(<List query="a" />));
    log.length = 0;
    await act(async () => root.render(<List query="ab" />));
    expect(log).toEqual(["query=ab deferred=a", "query=ab deferred=ab"]);
  });

  test("initialValue (React 19): the first render uses it, then the real value", async () => {
    const log: string[] = [];
    function List({ query }: { query: string }) {
      log.push(useDeferredValue(query, ""));
      return null;
    }
    await mount(<List query="react" />);
    expect(log).toEqual(["", "react"]);
  });
});

describe("<Activity> (19.2): hide without unmounting", () => {
  test("hidden content keeps state and DOM, unmounts effects, and resumes when visible", async () => {
    const log: string[] = [];
    let setMode!: (m: "visible" | "hidden") => void;
    let inc!: () => void;
    function Counter() {
      const [n, setN] = useState(0);
      inc = () => setN((x) => x + 1);
      useEffect(() => {
        log.push("effect mount");
        return () => void log.push("effect cleanup");
      }, []);
      return <u>{n}</u>;
    }
    function App() {
      const [mode, s] = useState<"visible" | "hidden">("visible");
      setMode = s;
      return (
        <Activity mode={mode}>
          <Counter />
        </Activity>
      );
    }
    const { container } = await mount(<App />);
    await act(async () => inc());
    await act(async () => setMode("hidden"));
    const u = container.querySelector("u")!;
    expect(u.textContent).toBe("1"); // DOM kept
    expect(u.style.display).toBe("none"); // hidden with display: none !important
    expect(log).toEqual(["effect mount", "effect cleanup"]);
    await act(async () => inc()); // updates still processed (at Offscreen priority)
    await act(async () => setMode("visible"));
    expect(container.querySelector("u")!.textContent).toBe("2"); // state survived
    expect(log).toEqual(["effect mount", "effect cleanup", "effect mount"]);
  });

  test("NEGATIVE: conditional rendering destroys the state that <Activity> would keep", async () => {
    let setShow!: (v: boolean) => void;
    let inc!: () => void;
    function Counter() {
      const [n, setN] = useState(0);
      inc = () => setN((x) => x + 1);
      return <u>{n}</u>;
    }
    function App() {
      const [show, s] = useState(true);
      setShow = s;
      return show ? <Counter /> : null;
    }
    const { container } = await mount(<App />);
    await act(async () => inc());
    await act(async () => setShow(false));
    await act(async () => setShow(true));
    expect(container.textContent).toBe("0");
  });

  test("content that starts hidden is pre-rendered (state exists) but effects do not run", async () => {
    const log: string[] = [];
    function Pre() {
      log.push("render");
      useEffect(() => void log.push("effect"), []);
      return <p>prerendered</p>;
    }
    const { container } = await mount(
      <Activity mode="hidden">
        <Pre />
      </Activity>,
    );
    expect(container.innerHTML).toContain("prerendered");
    expect(log).toEqual(["render"]);
  });
});
