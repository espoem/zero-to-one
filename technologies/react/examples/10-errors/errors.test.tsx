// @vitest-environment jsdom
/**
 * Module 10 — Errors & resilience. react-dom@19.3.1 in jsdom.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { Activity, Component, act, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root, type RootOptions } from "react-dom/client";

let roots: Root[] = [];
async function mount(node: ReactNode, options?: RootOptions) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container, options);
  roots.push(root);
  await act(async () => root.render(node));
  return { container, root };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

/** The canonical error boundary: there is still no hook equivalent in React 19.3. */
class Boundary extends Component<
  { children: ReactNode; name?: string; onCatch?: (e: Error, info: ErrorInfo) => void; resetKey?: unknown },
  { error: Error | null; resetKey?: unknown }
> {
  override state: { error: Error | null; resetKey?: unknown } = { error: null, resetKey: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error }; // render phase: must be pure, only computes fallback state
  }
  static getDerivedStateFromProps(props: { resetKey?: unknown }, state: { resetKey?: unknown; error: Error | null }) {
    // "resetKeys" pattern: clear the error when the key changes (e.g. the route).
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onCatch?.(error, info); // commit phase: side effects (logging) go here
  }
  override render() {
    return this.state.error ? (
      <p role="alert">
        {this.props.name ?? "boundary"}: {this.state.error.message}
      </p>
    ) : (
      this.props.children
    );
  }
}
function Boom({ message = "render failed" }: { message?: string }): ReactNode {
  throw new Error(message);
}

describe("what an error boundary catches", () => {
  test("errors thrown during render: fallback shown, componentDidCatch gets the component stack", async () => {
    quiet();
    const onCatch = vi.fn();
    const { container } = await mount(
      <Boundary onCatch={onCatch}>
        <section>
          <Boom />
        </section>
      </Boundary>,
    );
    expect(container.textContent).toBe("boundary: render failed");
    const info = onCatch.mock.calls[0]![1] as ErrorInfo;
    expect(info.componentStack).toMatch(/Boom/);
  });

  test("the nearest boundary wins; siblings outside it keep rendering", async () => {
    quiet();
    const { container } = await mount(
      <Boundary name="outer">
        <header>ok</header>
        <Boundary name="inner">
          <Boom />
        </Boundary>
      </Boundary>,
    );
    expect(container.textContent).toBe("okinner: render failed");
  });

  test("errors thrown in effects are caught too", async () => {
    quiet();
    function BadEffect() {
      useEffect(() => {
        throw new Error("effect failed");
      }, []);
      return <i>mounted</i>;
    }
    const { container } = await mount(
      <Boundary>
        <BadEffect />
      </Boundary>,
    );
    expect(container.textContent).toBe("boundary: effect failed");
  });

  test("NEGATIVE: errors in event handlers are NOT caught by boundaries", async () => {
    quiet();
    const thrown: unknown[] = [];
    const onWindowError = (e: ErrorEvent) => {
      thrown.push(e.error);
      e.preventDefault();
    };
    window.addEventListener("error", onWindowError);
    function Button() {
      return (
        <button
          onClick={() => {
            throw new Error("click failed");
          }}
        >
          go
        </button>
      );
    }
    const { container } = await mount(
      <Boundary>
        <Button />
      </Boundary>,
    );
    act(() => container.querySelector("button")!.click());
    window.removeEventListener("error", onWindowError);
    expect(container.textContent).toBe("go"); // no fallback
    expect(String(thrown[0])).toContain("click failed");
  });

  test("NEGATIVE: errors in async code (after await, timers) are NOT caught", async () => {
    const unhandled: unknown[] = [];
    function Loader() {
      useEffect(() => {
        void (async () => {
          await Promise.resolve();
          try {
            throw new Error("fetch failed");
          } catch (e) {
            unhandled.push(e); // without this catch it would be an unhandled rejection
          }
        })();
      }, []);
      return <i>loader</i>;
    }
    const { container } = await mount(
      <Boundary>
        <Loader />
      </Boundary>,
    );
    expect(container.textContent).toBe("loader");
    expect(unhandled).toHaveLength(1);
  });

  test("forwarding an async/event error into the boundary: throw inside a state updater", async () => {
    quiet();
    function Loader() {
      const [, setState] = useState(0);
      return (
        <button
          onClick={async () => {
            await Promise.resolve();
            const error = new Error("forwarded");
            setState(() => {
              throw error; // re-thrown during the next render → caught by the boundary
            });
          }}
        >
          load
        </button>
      );
    }
    const { container } = await mount(
      <Boundary>
        <Loader />
      </Boundary>,
    );
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toBe("boundary: forwarded");
  });

  test("NEGATIVE: a boundary cannot catch its own render error (it propagates to the parent)", async () => {
    quiet();
    class SelfBroken extends Boundary {
      override render(): ReactNode {
        throw new Error("boundary itself failed");
      }
    }
    const { container } = await mount(
      <Boundary name="parent">
        <SelfBroken>
          <i>child</i>
        </SelfBroken>
      </Boundary>,
    );
    expect(container.textContent).toBe("parent: boundary itself failed");
  });
});

describe("root error callbacks (React 19)", () => {
  test("onCaughtError reports errors handled by a boundary, with the boundary instance", async () => {
    quiet();
    const onCaughtError = vi.fn();
    await mount(
      <Boundary>
        <Boom />
      </Boundary>,
      { onCaughtError },
    );
    expect(onCaughtError).toHaveBeenCalledTimes(1);
    const [error, info] = onCaughtError.mock.calls[0]! as [Error, { componentStack: string; errorBoundary: unknown }];
    expect(error.message).toBe("render failed");
    expect(info.errorBoundary).toBeInstanceOf(Boundary);
    expect(info.componentStack).toMatch(/Boom/);
  });

  test("onUncaughtError reports errors with no boundary; the root is unmounted", async () => {
    // Outside act(): inside act() uncaught errors are rethrown to the test instead.
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    g.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const onUncaughtError = vi.fn();
      const container = document.createElement("div");
      container.innerHTML = "<p>server html</p>";
      const root = createRoot(container, { onUncaughtError });
      root.render(<Boom message="no boundary" />);
      await new Promise((r) => setTimeout(r, 30));
      expect(onUncaughtError).toHaveBeenCalledTimes(1);
      expect((onUncaughtError.mock.calls[0]![0] as Error).message).toBe("no boundary");
      expect(container.innerHTML).toBe(""); // the whole tree is gone
      root.unmount();
    } finally {
      g.IS_REACT_ACT_ENVIRONMENT = true;
    }
  });

  test("an error thrown once and recovered by a synchronous retry → onRecoverableError", async () => {
    // React retries a failed concurrent render once synchronously before giving up.
    let failures = 1;
    function Flaky() {
      if (failures-- > 0) throw new Error("transient");
      return <i>recovered</i>;
    }
    quiet();
    const onRecoverableError = vi.fn();
    const onCaughtError = vi.fn();
    const { container } = await mount(<Flaky />, { onRecoverableError, onCaughtError });
    expect(container.textContent).toBe("recovered");
    expect(onRecoverableError).toHaveBeenCalledTimes(1);
    expect(onCaughtError).not.toHaveBeenCalled();
  });
});

describe("recovery", () => {
  test("NEGATIVE: once in the error state, re-rendering the same children does not recover", async () => {
    quiet();
    let setBroken!: (b: boolean) => void;
    function Maybe() {
      const [broken, s] = useState(true);
      setBroken = s;
      return broken ? <Boom message="first" /> : <i>fine</i>;
    }
    const { container } = await mount(
      <Boundary>
        <Maybe />
      </Boundary>,
    );
    expect(container.textContent).toBe("boundary: first");
    // Maybe is unmounted while the fallback shows: its setter no longer reaches anything.
    await act(async () => setBroken(false));
    expect(container.textContent).toBe("boundary: first");
  });

  test("reset by key: a new key remounts boundary and children with fresh state", async () => {
    quiet();
    let fail = true;
    function Page() {
      if (fail) throw new Error("route failed");
      return <i>page ok</i>;
    }
    const { container, root } = await mount(
      <Boundary key="route-1">
        <Page />
      </Boundary>,
    );
    expect(container.textContent).toBe("boundary: route failed");
    fail = false;
    await act(async () =>
      root.render(
        <Boundary key="route-2">
          <Page />
        </Boundary>,
      ),
    );
    expect(container.textContent).toBe("page ok");
  });

  test("reset by resetKey prop (getDerivedStateFromProps) keeps the boundary instance", async () => {
    quiet();
    let fail = true;
    function Page() {
      if (fail) throw new Error("route failed");
      return <i>page ok</i>;
    }
    const { container, root } = await mount(
      <Boundary resetKey="/a">
        <Page />
      </Boundary>,
    );
    fail = false;
    await act(async () =>
      root.render(
        <Boundary resetKey="/b">
          <Page />
        </Boundary>,
      ),
    );
    expect(container.textContent).toBe("page ok");
  });
});

describe("errors and <Activity> (19.3)", () => {
  test("an error in hidden content does not escape while hidden; it surfaces when shown", async () => {
    quiet();
    let setMode!: (m: "visible" | "hidden") => void;
    let arm!: () => void;
    function Maybe() {
      const [broken, s] = useState(false);
      arm = () => s(true);
      if (broken) throw new Error("hidden failure");
      return <i>ok</i>;
    }
    function App() {
      const [mode, s] = useState<"visible" | "hidden">("visible");
      setMode = s;
      return (
        <Boundary name="outer">
          <Activity mode={mode}>
            <Maybe />
          </Activity>
        </Boundary>
      );
    }
    const { container } = await mount(<App />);
    await act(async () => setMode("hidden"));
    await act(async () => arm());
    expect(container.querySelector("i")!.textContent).toBe("ok"); // still the hidden, last good UI
    expect(container.textContent).not.toContain("outer:");
    await act(async () => setMode("visible"));
    expect(container.textContent).toBe("outer: hidden failure");
  });
});
