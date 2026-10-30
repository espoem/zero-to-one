// @vitest-environment jsdom
/**
 * Module 12 — Performance, testing, upgrades & production operations. react-dom@19.3.1.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import fc from "fast-check";
import {
  Component,
  Profiler,
  Suspense,
  act,
  createContext,
  createElement,
  lazy,
  memo,
  use,
  useMemo,
  useState,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from "react";
import * as ReactDOM from "react-dom";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act as testUtilsAct } from "react-dom/test-utils";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { visibleRange } from "./virtual-window.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("measuring: <Profiler>", () => {
  test("onRender reports phase and timings for each commit of the subtree", async () => {
    const commits: Array<{ id: string; phase: string; actual: number; base: number }> = [];
    const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) =>
      void commits.push({ id, phase, actual: actualDuration, base: baseDuration });
    function Counter() {
      const [n, setN] = useState(0);
      return <button onClick={() => setN(n + 1)}>{n}</button>;
    }
    render(
      <Profiler id="counter" onRender={onRender}>
        <Counter />
      </Profiler>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(commits.map((c) => `${c.id}:${c.phase}`)).toEqual(["counter:mount", "counter:update"]);
    for (const c of commits) {
      expect(c.actual).toBeGreaterThanOrEqual(0);
      expect(c.base).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("render cost: context identity and splitting", () => {
  function setup(stable: boolean) {
    const Ctx = createContext<{ user: string; setTheme: (t: string) => void } | null>(null);
    const userRenders = vi.fn();
    const UserBadge = memo(function UserBadge() {
      userRenders();
      return <i>{use(Ctx)!.user}</i>;
    });
    function Provider({ children }: { children: ReactNode }) {
      const [theme, setTheme] = useState("light");
      const memoValue = useMemo(() => ({ user: "ada", setTheme }), []);
      const value = stable ? memoValue : { user: "ada", setTheme }; // inline object = new identity each render
      return (
        <Ctx value={value}>
          <span>{theme}</span>
          <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>toggle</button>
          {children}
        </Ctx>
      );
    }
    render(
      <Provider>
        <UserBadge />
      </Provider>,
    );
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button"));
    return userRenders.mock.calls.length;
  }

  test("NEGATIVE: an inline context value re-renders every consumer, even under memo", () => {
    expect(setup(false)).toBe(4);
  });

  test("a memoised (stable) value lets unrelated consumers skip", () => {
    expect(setup(true)).toBe(1);
  });
});

describe("list virtualisation: render only the visible window", () => {
  test("example: 10,000 rows, 600px viewport, 30px rows → ~20 rows + overscan", () => {
    expect(visibleRange({ scrollTop: 3000, viewport: 600, rowHeight: 30, count: 10_000, overscan: 3 })).toEqual({
      start: 97,
      end: 123,
    });
  });

  test("property: the window always covers the viewport and stays within bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 400_000 }),
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 0, max: 10 }),
        (count, scrollTop, viewport, rowHeight, overscan) => {
          const { start, end } = visibleRange({ scrollTop, viewport, rowHeight, count, overscan });
          const firstVisible = Math.floor(scrollTop / rowHeight);
          const lastVisible = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight));
          const inBounds = 0 <= start && start <= end && end <= count;
          const covers = firstVisible >= count || (start <= firstVisible && end >= lastVisible);
          return inBounds && covers;
        },
      ),
    );
  });

  test("rendering a windowed list mounts only the visible rows", () => {
    function Rows({ scrollTop }: { scrollTop: number }) {
      const { start, end } = visibleRange({ scrollTop, viewport: 300, rowHeight: 30, count: 10_000, overscan: 2 });
      const rows = [];
      for (let i = start; i < end; i++) rows.push(<li key={i}>row {i}</li>);
      return <ul style={{ paddingTop: start * 30 }}>{rows}</ul>;
    }
    const { container, rerender } = render(<Rows scrollTop={0} />);
    expect(container.querySelectorAll("li")).toHaveLength(12);
    rerender(<Rows scrollTop={150_000} />);
    expect(container.querySelector("li")!.textContent).toBe("row 4998");
  });
});

describe("code splitting with lazy()", () => {
  test("lazy loads the module on first render and suspends until it resolves", async () => {
    let loads = 0;
    const Chart = lazy(async () => {
      loads++;
      return { default: () => <figure>chart</figure> };
    });
    render(
      <Suspense fallback={<i>loading chart</i>}>
        <Chart />
      </Suspense>,
    );
    expect(screen.getByText("loading chart")).toBeTruthy();
    expect(await screen.findByText("chart")).toBeTruthy();
    expect(loads).toBe(1);
  });

  test("NEGATIVE: lazy() inside a component creates a new type each render (remount + reload)", async () => {
    let loads = 0;
    function Page({ n }: { n: number }) {
      // Deliberate anti-pattern: must be at module level.
      const Widget = lazy(async () => {
        loads++;
        return { default: () => <b>widget {n}</b> };
      });
      return (
        <Suspense fallback="…">
          <Widget />
        </Suspense>
      );
    }
    const { rerender } = render(<Page n={1} />);
    await screen.findByText("widget 1");
    rerender(<Page n={2} />);
    await screen.findByText("widget 2");
    expect(loads).toBe(2);
  });
});

describe("testing with React Testing Library and act", () => {
  test("findBy* waits for async UI; getBy* is synchronous", async () => {
    function Greeting() {
      const [name, setName] = useState<string | null>(null);
      return (
        <>
          <button onClick={() => setTimeout(() => setName("Ada"), 10)}>load</button>
          {name && <p>hello {name}</p>}
        </>
      );
    }
    render(<Greeting />);
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    expect(screen.queryByText("hello Ada")).toBeNull();
    expect(await screen.findByText("hello Ada")).toBeTruthy();
  });

  test("testing Suspense: render inside an AWAITED act, resolve inside act, then assert", async () => {
    let resolve!: (v: string) => void;
    const p = new Promise<string>((r) => (resolve = r));
    function Data() {
      return <p>{use(p)}</p>;
    }
    // Observed with react 19.3.1 + RTL 16.3.3: when the initial render() (a synchronous act)
    // suspends, the boundary never revealed after resolve(). Rendering inside an awaited
    // async act lets act track the suspended promise.
    await act(async () => {
      render(
        <Suspense fallback={<i>…</i>}>
          <Data />
        </Suspense>,
      );
    });
    expect(screen.getByText("…")).toBeTruthy();
    await act(async () => resolve("loaded"));
    expect(screen.getByText("loaded")).toBeTruthy();
  });

  test("NEGATIVE: updates outside act() in a test warn", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    let set!: (n: number) => void;
    function C() {
      const [n, s] = useState(0);
      set = s;
      return <p>{n}</p>;
    }
    render(<C />);
    set(1); // not wrapped in act
    expect(errors.join("\n")).toMatch(/not wrapped in act/);
    await act(async () => {});
  });

  test("react-dom/test-utils act is deprecated in favour of React.act", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    await testUtilsAct(async () => {});
    expect(errors.join("\n")).toMatch(/ReactDOMTestUtils\.act` is deprecated in favor of `React\.act`/);
  });
});

describe("upgrading 18 → 19: removed APIs", () => {
  test("legacy root and DOM APIs are gone from react-dom", () => {
    const rd = ReactDOM as unknown as Record<string, unknown>;
    for (const name of ["render", "hydrate", "unmountComponentAtNode", "findDOMNode", "unstable_renderSubtreeIntoContainer"]) {
      expect(rd[name], name).toBeUndefined();
    }
    expect(typeof ReactDOM.createPortal).toBe("function");
  });

  test("createFactory and the bundled PropTypes are gone from react", () => {
    const r = React as unknown as Record<string, unknown>;
    expect(r.createFactory).toBeUndefined();
    expect(r.PropTypes).toBeUndefined();
  });

  test("propTypes are ignored and defaultProps on function components no longer apply", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    function Hello({ name }: { name?: string }) {
      return <p>{name ?? "no default applied"}</p>;
    }
    Object.assign(Hello, { defaultProps: { name: "default" }, propTypes: { name: () => new Error("never checked") } });
    render(<Hello />);
    expect(screen.getByText("no default applied")).toBeTruthy();
    expect(errors).toEqual([]); // propTypes are not run
  });

  test("defaultProps still work on class components", () => {
    class Hello extends Component<{ name?: string }> {
      static defaultProps = { name: "class default" };
      override render() {
        return <p>{this.props.name}</p>;
      }
    }
    render(<Hello />);
    expect(screen.getByText("class default")).toBeTruthy();
  });

  test("NEGATIVE: string refs throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    class Legacy extends Component {
      override render() {
        return createElement("input", { ref: "field" } as never);
      }
    }
    const root = createRoot(document.createElement("div"));
    await expect(act(async () => root.render(<Legacy />))).rejects.toThrow(/Expected ref to be a function/);
  });
});
