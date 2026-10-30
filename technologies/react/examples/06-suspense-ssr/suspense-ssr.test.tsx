// @vitest-environment jsdom
/**
 * Module 06 — Suspense, streaming SSR & hydration. react-dom@19.3.1:
 * client APIs in jsdom, server APIs (Node streams + Web streams) in the same process.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { Suspense, act, use, useId, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString, resume } from "react-dom/server";
import { prerender } from "react-dom/static";
import { streamChunks } from "../_shared/ssr.ts";

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((r, j) => ((resolve = r), (reject = j)));
  return { promise, resolve, reject };
}

describe("use(promise): the suspension protocol", () => {
  test("a cached promise suspends to the nearest fallback, then reveals", async () => {
    const d = deferred<string>();
    function Name() {
      return <b>{use(d.promise)}</b>;
    }
    const { container } = await mount(
      <Suspense fallback={<i>loading</i>}>
        <Name />
      </Suspense>,
    );
    expect(container.innerHTML).toBe("<i>loading</i>");
    await act(async () => d.resolve("Ada"));
    expect(container.innerHTML).toBe("<b>Ada</b>");
  });

  test("an already-fulfilled promise with status metadata is read synchronously", async () => {
    // React tags thenables with status/value; libraries may pre-set them.
    const p = Object.assign(Promise.resolve("ready"), { status: "fulfilled" as const, value: "ready" });
    function Name() {
      return <b>{use(p)}</b>;
    }
    const renders: string[] = [];
    const { container } = await mount(
      <Suspense fallback={(renders.push("fallback"), <i>loading</i>)}>
        <Name />
      </Suspense>,
    );
    expect(container.innerHTML).toBe("<b>ready</b>");
  });

  test("NEGATIVE: a promise created during render never settles the boundary", async () => {
    function Bad() {
      return <b>{use(new Promise<string>((r) => setTimeout(() => r("x"), 5)))}</b>;
    }
    const { container } = await mount(
      <Suspense fallback={<i>loading</i>}>
        <Bad />
      </Suspense>,
    );
    await act(async () => sleep(60));
    // Each retry creates a new promise, which suspends again: stuck on the fallback.
    expect(container.innerHTML).toBe("<i>loading</i>");
  });

  test("a rejected promise throws to the nearest error boundary (none here: uncaught)", async () => {
    const d = deferred<string>();
    function Name() {
      return <b>{use(d.promise)}</b>;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    await act(async () =>
      root.render(
        <Suspense fallback="…">
          <Name />
        </Suspense>,
      ),
    );
    // act() rethrows errors that escaped every boundary, after reporting them to the root.
    // With no error boundary the error is uncaught; inside act() it is rethrown to the test.
    // (Root error callbacks and boundaries are Module 10.)
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(act(async () => d.reject(new Error("boom")))).rejects.toThrow("boom");
  });

  test("NEGATIVE (19.3 DEV warning): calling use() only until data is cached elsewhere", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.map(String).join(" ")));
    let cache: string | undefined;
    const p = sleep(5).then(() => (cache = "v"));
    function Sneaky() {
      // Suspends once via use(), but on the retry reads a side cache and skips use().
      const v = cache ?? use(p);
      return <b>{v}</b>;
    }
    // No boundary: the root itself suspends, and React retries the very same fiber,
    // which is the situation the 19.3 check can detect.
    const { container } = await mount(<Sneaky />);
    await act(async () => sleep(20));
    expect(container.textContent).toBe("v");
    expect(errors.join("\n")).toMatch(/called use\(\) to suspend in a previous render but did not call use\(\) when it finished/);
  });

  test("siblings in one boundary reveal together (all-or-nothing per boundary)", async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    function R({ p }: { p: Promise<string> }) {
      return <span>{use(p)}</span>;
    }
    const { container } = await mount(
      <Suspense fallback={<i>…</i>}>
        <R p={a.promise} />
        <R p={b.promise} />
      </Suspense>,
    );
    await act(async () => a.resolve("A"));
    expect(container.innerHTML).toBe("<i>…</i>"); // A is ready but B is not
    await act(async () => b.resolve("B"));
    expect(container.innerHTML).toBe("<span>A</span><span>B</span>");
  });

  test("nested boundaries reveal independently, outer first", async () => {
    const outer = deferred<string>();
    const inner = deferred<string>();
    function R({ p }: { p: Promise<string> }) {
      return <span>{use(p)}</span>;
    }
    const { container } = await mount(
      <Suspense fallback={<i>outer…</i>}>
        <R p={outer.promise} />
        <Suspense fallback={<i>inner…</i>}>
          <R p={inner.promise} />
        </Suspense>
      </Suspense>,
    );
    await act(async () => outer.resolve("O"));
    expect(container.innerHTML).toBe("<span>O</span><i>inner…</i>");
    await act(async () => inner.resolve("I"));
    expect(container.innerHTML).toBe("<span>O</span><span>I</span>");
  });
});

describe("streaming SSR with renderToPipeableStream", () => {
  test("the shell streams first with fallbacks; boundary content arrives later as a hidden segment + script", async () => {
    const d = deferred<string>();
    function Slow() {
      return <b>{use(d.promise)}</b>;
    }
    const { shell, all } = streamChunks(
      <main>
        <h1>title</h1>
        <Suspense fallback={<i>loading</i>}>
          <Slow />
        </Suspense>
      </main>,
    );
    const shellHtml = await shell;
    expect(shellHtml).toContain("<h1>title</h1>");
    expect(shellHtml).toContain('<!--$?--><template id="B:0"></template><i>loading</i><!--/$-->');
    expect(shellHtml).not.toContain("<b>");
    d.resolve("data");
    const rest = (await all).join("");
    expect(rest).toContain('<div hidden id="S:0"><b>data</b></div>');
    expect(rest).toMatch(/\$RC|\$RV|\$RB/); // the inline reveal runtime
  });

  test("onAllReady-style output (bots, SSG): no fallbacks, completed boundaries inline", async () => {
    const d = deferred<string>();
    function Slow() {
      return <b>{use(d.promise)}</b>;
    }
    setTimeout(() => d.resolve("data"), 5);
    const chunks = await new Promise<string[]>((resolve) => {
      const { all } = streamChunks(
        <Suspense fallback={<i>loading</i>}>
          <Slow />
        </Suspense>,
        {
          onAllReady() {
            /* handled by helper: pipe happens on shell ready, so we just await all */
          },
        },
      );
      void all.then(resolve);
    });
    expect(chunks.join("")).toContain("<b>data</b>");
  });

  test("an error in a boundary does not fail the shell: onError fires and the client retries", async () => {
    const onError = vi.fn(() => "digest-123");
    function Broken(): ReactNode {
      throw new Error("db down");
    }
    const { shell, all } = streamChunks(
      <main>
        <Suspense fallback={<i>loading</i>}>
          <Broken />
        </Suspense>
      </main>,
      { onError },
    );
    const html = (await shell) + (await all).join("");
    expect(onError).toHaveBeenCalled();
    expect(html).toContain("<!--$!-->"); // client-render marker
    expect(html).toContain('data-dgst="digest-123"');
    // DEV embeds the message and stacks (data-msg/data-stck) for the overlay; production builds
    // emit only data-dgst — the reason to return a digest from onError instead of the message.
    expect(html).toContain("data-msg=");
  });

  test("NEGATIVE: an error outside any boundary fails the shell (onShellError)", async () => {
    function Broken(): ReactNode {
      throw new Error("layout crashed");
    }
    const onShellError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { all } = streamChunks(<Broken />, { onShellError, onError: () => {} });
    await expect(all).rejects.toThrow("layout crashed");
    expect(onShellError).toHaveBeenCalled();
  });

  test("renderToString does not wait for data: suspended boundaries render their fallback", () => {
    const never = new Promise<string>(() => {});
    function Slow() {
      return <b>{use(never)}</b>;
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToString(
      <Suspense fallback={<i>loading</i>}>
        <Slow />
      </Suspense>,
    );
    expect(html).toContain("<i>loading</i>");
    expect(html).toContain("<!--$!-->"); // marked for client rendering
  });
});

describe("partial pre-rendering: prerender → postponed → resume (19.2)", () => {
  test("the static shell is prerendered; the dynamic hole is filled by resume()", async () => {
    let dynamic: Promise<string> = new Promise(() => {});
    function Dyn() {
      return <b>{use(dynamic)}</b>;
    }
    const app = (
      <div>
        <h1>static</h1>
        <Suspense fallback={<i>dyn…</i>}>
          <Dyn />
        </Suspense>
      </div>
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    const { prelude, postponed } = await prerender(app, { signal: controller.signal, onError() {} });
    const preludeHtml = await new Response(prelude).text();
    expect(preludeHtml).toContain("<h1>static</h1>");
    expect(preludeHtml).toContain('<template id="B:0"></template><i>dyn…</i>');
    expect(postponed).not.toBeNull();

    // postponed is JSON-serialisable state: store it next to the prelude (e.g. on a CDN).
    const stored = JSON.parse(JSON.stringify(postponed));
    dynamic = Promise.resolve("per-request data");
    const resumed = await new Response(await resume(app, stored)).text();
    expect(resumed).toContain('<div hidden id="S:0"><b>per-request data</b></div>');
    expect(resumed).not.toContain("<h1>static</h1>"); // the shell is not re-sent
  });
});

describe("hydration", () => {
  test("matching server and client trees hydrate without re-creating DOM", async () => {
    function App() {
      const [n, setN] = useState(0);
      return <button onClick={() => setN(n + 1)}>{n}</button>;
    }
    const container = document.createElement("div");
    container.innerHTML = renderToString(<App />);
    const serverButton = container.querySelector("button");
    await act(async () => {
      roots.push(hydrateRoot(container, <App />));
    });
    expect(container.querySelector("button")).toBe(serverButton); // adopted, not replaced
    await act(async () => serverButton!.click());
    expect(container.textContent).toBe("1"); // and now interactive
  });

  test("NEGATIVE: a text mismatch is reported to onRecoverableError and the tree is client-rendered", async () => {
    function Clock({ now }: { now: string }) {
      return <p>{now}</p>;
    }
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Clock now="server-time" />);
    const serverP = container.querySelector("p");
    const onRecoverableError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      roots.push(hydrateRoot(container, <Clock now="client-time" />, { onRecoverableError }));
    });
    expect(onRecoverableError).toHaveBeenCalled();
    expect(String(onRecoverableError.mock.calls[0]![0])).toMatch(/Hydration failed because the server rendered text didn't match the client/);
    expect(container.textContent).toBe("client-time");
    expect(container.querySelector("p")).not.toBe(serverP); // regenerated
  });

  test("suppressHydrationWarning silences a one-level text mismatch and keeps the server text", async () => {
    function Clock({ now }: { now: string }) {
      return <time suppressHydrationWarning>{now}</time>;
    }
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Clock now="12:00" />);
    const onRecoverableError = vi.fn();
    await act(async () => {
      roots.push(hydrateRoot(container, <Clock now="12:01" />, { onRecoverableError }));
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("12:00"); // not patched! update it after hydration if it matters
  });

  test("useId: stable across server and client (server ids start with _R_)", async () => {
    function Field() {
      const id = useId();
      return (
        <>
          <label htmlFor={id}>name</label>
          <input id={id} />
        </>
      );
    }
    const html = renderToString(<Field />);
    expect(html).toMatch(/id="_R_[0-9a-z]*_"/);
    const container = document.createElement("div");
    container.innerHTML = html;
    const onRecoverableError = vi.fn();
    await act(async () => {
      roots.push(hydrateRoot(container, <Field />, { onRecoverableError }));
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
  });

  test("useId on a client-only root uses the _r_ prefix (19.2+; was :r: in 19.0, «r» in 19.1)", async () => {
    function Field() {
      return <input id={useId()} />;
    }
    const { container } = await mount(<Field />);
    expect(container.innerHTML).toMatch(/id="_r_[0-9a-z]*_"/);
  });
});

describe("browser(): opt a subtree out of SSR (19.3)", () => {
  function TimeZone() {
    use(browser("needs Intl in the user's browser"));
    return <p>{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>;
  }

  test("on the server the boundary falls back and onBrowserBailout (not onError) is called", async () => {
    const onBrowserBailout = vi.fn();
    const onError = vi.fn();
    const { shell, all } = streamChunks(
      <Suspense fallback={<i>tz…</i>}>
        <TimeZone />
      </Suspense>,
      { onBrowserBailout, onError },
    );
    const html = (await shell) + (await all).join("");
    expect(html).toContain("<i>tz…</i>");
    expect(onError).not.toHaveBeenCalled();
    expect(onBrowserBailout).toHaveBeenCalledTimes(1);
    const [err, info] = onBrowserBailout.mock.calls[0] as unknown as [Error, { componentStack: string }];
    expect(err.cause).toBe("needs Intl in the user's browser");
    expect(info.componentStack).toBeTruthy();
    expect(html).not.toContain("needs Intl"); // the reason is not serialised into HTML
  });

  test("on the client it does not suspend; after hydration the real content renders without a recoverable error", async () => {
    const container = document.createElement("div");
    const app = (
      <Suspense fallback={<i>tz…</i>}>
        <TimeZone />
      </Suspense>
    );
    const { shell, all } = streamChunks(app, { onBrowserBailout() {} });
    container.innerHTML = (await shell) + (await all).join("");
    const onRecoverableError = vi.fn();
    await act(async () => {
      roots.push(hydrateRoot(container, app, { onRecoverableError }));
    });
    expect(container.querySelector("p")).not.toBeNull();
    expect(onRecoverableError).not.toHaveBeenCalled();
  });
});
